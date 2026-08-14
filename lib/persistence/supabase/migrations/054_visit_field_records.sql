-- HomeAtlas visit field records: private phone-photo storage, replay-safe
-- appointment documentation, and customer-visible portal evidence.

alter table public.property_assets
  add column if not exists storage_bucket text,
  add column if not exists capture_type text,
  add column if not exists customer_visible boolean not null default false,
  add column if not exists captured_by text,
  add column if not exists field_record_id uuid;

alter table public.property_assets
  drop constraint if exists property_assets_capture_type_check,
  add constraint property_assets_capture_type_check check (
    capture_type is null or capture_type in ('before', 'after', 'detail')
  );

alter table public.property_assessments
  add column if not exists field_record_id uuid;

create unique index if not exists property_assessments_field_record_uidx
  on public.property_assessments(field_record_id)
  where field_record_id is not null;
create unique index if not exists property_assets_storage_identity_uidx
  on public.property_assets(storage_bucket, storage_path)
  where storage_bucket is not null;
create index if not exists property_assets_portal_visit_idx
  on public.property_assets(property_id, captured_at desc)
  where kind = 'photo' and customer_visible = true;
create index if not exists property_assets_field_record_idx
  on public.property_assets(field_record_id, created_at);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'homeatlas-visit-media',
  'homeatlas-visit-media',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "homeatlas_visit_media_service_role_all"
  on storage.objects;
create policy "homeatlas_visit_media_service_role_all"
  on storage.objects for all to service_role
  using (bucket_id = 'homeatlas-visit-media')
  with check (bucket_id = 'homeatlas-visit-media');

-- The early field-intelligence migrations predated server-only customer data.
-- These records contain private notes, photos, and customer history; browser
-- roles must never read or mutate them directly.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'member_profiles',
        'member_savings_transactions',
        'service_observations',
        'ai_quotes',
        'property_assessments',
        'property_visit_health_checks'
      ])
      and (
        'anon' = any(roles)
        or 'authenticated' = any(roles)
        or 'public' = any(roles)
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

revoke all privileges on table public.member_profiles
  from public, anon, authenticated;
revoke all privileges on table public.member_savings_transactions
  from public, anon, authenticated;
revoke all privileges on table public.service_observations
  from public, anon, authenticated;
revoke all privileges on table public.ai_quotes
  from public, anon, authenticated;
revoke all privileges on table public.property_assessments
  from public, anon, authenticated;
revoke all privileges on table public.property_visit_health_checks
  from public, anon, authenticated;

grant select, insert, update, delete on table public.member_profiles
  to service_role;
grant select, insert, update, delete on table public.member_savings_transactions
  to service_role;
grant select, insert, update, delete on table public.service_observations
  to service_role;
grant select, insert, update, delete on table public.ai_quotes
  to service_role;
grant select, insert, update, delete on table public.property_assessments
  to service_role;
grant select, insert, update, delete on table public.property_visit_health_checks
  to service_role;

create or replace function public.commit_visit_field_record(
  p_field_record_id uuid,
  p_property_id uuid,
  p_appointment_id uuid,
  p_technician_name text,
  p_visit_date date,
  p_customer_note text,
  p_internal_note text,
  p_follow_up_needed boolean,
  p_assets jsonb
)
returns table(assessment_id uuid, asset_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_homeowner_id uuid;
  resolved_assessment_id uuid;
  resolved_assessment_property_id uuid;
  resolved_assessment_visit_id uuid;
  normalized_assets jsonb := coalesce(p_assets, '[]'::jsonb);
begin
  if p_field_record_id is null
     or p_property_id is null
     or p_appointment_id is null
     or nullif(trim(p_technician_name), '') is null
     or length(trim(p_technician_name)) > 80
     or p_visit_date is null
     or length(coalesce(p_customer_note, '')) > 1200
     or length(coalesce(p_internal_note, '')) > 2500
     or p_follow_up_needed is null
     or jsonb_typeof(normalized_assets) <> 'array'
     or jsonb_array_length(normalized_assets) > 8 then
    raise exception 'Invalid visit field record input';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_assets) asset
    where jsonb_typeof(asset) <> 'object'
      or nullif(asset->>'storagePath', '') is null
      or left(
        asset->>'storagePath',
        length(format(
          'properties/%s/visits/%s/records/%s/',
          p_property_id,
          p_appointment_id,
          p_field_record_id
        ))
      ) <> format(
        'properties/%s/visits/%s/records/%s/',
        p_property_id,
        p_appointment_id,
        p_field_record_id
      )
      or coalesce(asset->>'mimeType', '') not in (
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
      )
      or coalesce(asset->>'captureType', '') not in ('before', 'after', 'detail')
      or coalesce(jsonb_typeof(asset->'customerVisible'), '') <> 'boolean'
      or coalesce(jsonb_typeof(asset->'sizeBytes'), '') <> 'number'
      or case
        when jsonb_typeof(asset->'sizeBytes') = 'number'
          then (asset->>'sizeBytes')::numeric < 1
            or (asset->>'sizeBytes')::numeric > 15728640
            or trunc((asset->>'sizeBytes')::numeric) <> (asset->>'sizeBytes')::numeric
        else true
      end
  ) then
    raise exception 'Invalid visit photo metadata';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_field_record_id::text, 0));

  select pa.id, pa.property_id, pa.visit_id
    into resolved_assessment_id,
      resolved_assessment_property_id,
      resolved_assessment_visit_id
  from public.property_assessments pa
  where pa.field_record_id = p_field_record_id;

  if resolved_assessment_id is not null then
    if resolved_assessment_property_id <> p_property_id
       or resolved_assessment_visit_id <> p_appointment_id then
      raise exception 'Field record ID does not belong to this visit';
    end if;
    return query
      select resolved_assessment_id,
        count(*)::integer
      from public.property_assets asset
      where asset.field_record_id = p_field_record_id;
    return;
  end if;

  select property.homeowner_id
    into resolved_homeowner_id
  from public.properties property
  join public.member_appointments appointment
    on appointment.id = p_appointment_id
   and appointment.property_id = property.id
  where property.id = p_property_id;

  if resolved_homeowner_id is null then
    raise exception 'Appointment does not belong to the HomeAtlas property';
  end if;

  if nullif(trim(coalesce(p_customer_note, '')), '') is null
     and nullif(trim(coalesce(p_internal_note, '')), '') is null
     and jsonb_array_length(normalized_assets) = 0 then
    raise exception 'Visit field record must contain a note or photo';
  end if;

  insert into public.property_assessments (
    property_id,
    visit_id,
    assessment_type,
    technician_name,
    visit_date,
    internal_note,
    customer_note,
    customer_note_visible,
    proposal_summary,
    recommended_services,
    field_record_id
  )
  values (
    p_property_id,
    p_appointment_id,
    'visit_note'::assessment_type,
    trim(p_technician_name),
    p_visit_date,
    nullif(trim(coalesce(p_internal_note, '')), ''),
    nullif(trim(coalesce(p_customer_note, '')), ''),
    nullif(trim(coalesce(p_customer_note, '')), '') is not null,
    case when p_follow_up_needed then 'Follow-up recommended' else null end,
    case when p_follow_up_needed then
      jsonb_build_array(jsonb_build_object(
        'id', 'follow-up',
        'service', 'Follow-up recommended',
        'priority', 'medium',
        'note', ''
      ))
    else null end,
    p_field_record_id
  )
  returning id into resolved_assessment_id;

  insert into public.property_assets (
    property_id,
    homeowner_id,
    kind,
    category,
    title,
    description,
    storage_path,
    storage_bucket,
    mime_type,
    file_size_bytes,
    visit_id,
    photo_source,
    capture_type,
    customer_visible,
    captured_by,
    field_record_id,
    captured_at
  )
  select
    p_property_id,
    resolved_homeowner_id,
    'photo',
    'visit',
    case asset->>'captureType'
      when 'before' then 'Before service'
      when 'after' then 'After service'
      else 'Visit detail'
    end,
    nullif(trim(coalesce(p_customer_note, '')), ''),
    asset->>'storagePath',
    'homeatlas-visit-media',
    asset->>'mimeType',
    (asset->>'sizeBytes')::bigint,
    p_appointment_id,
    'our_team',
    asset->>'captureType',
    coalesce((asset->>'customerVisible')::boolean, false),
    trim(p_technician_name),
    p_field_record_id,
    now()
  from jsonb_array_elements(normalized_assets) asset;

  return query
    select resolved_assessment_id, jsonb_array_length(normalized_assets);
end;
$$;

revoke all on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, jsonb
) to service_role;

comment on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, jsonb
) is
  'Atomically and idempotently commits an HQ visit note and its private-storage photo metadata.';
