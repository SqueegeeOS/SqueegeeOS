-- Durable technician closeout for the exact service scope mirrored from Jobber.
-- Migration 054 remains backward compatible: this adds an overloaded RPC so
-- the previous app and the scope-aware app can overlap safely during rollout.

alter table public.property_assessments
  add column if not exists scope_read_state text,
  add column if not exists service_scope jsonb not null default '[]'::jsonb,
  add column if not exists scope_exception text;

alter table public.property_assessments
  drop constraint if exists property_assessments_scope_read_state_check,
  add constraint property_assessments_scope_read_state_check check (
    scope_read_state is null
    or scope_read_state in (
      'available', 'partial', 'permission_hidden', 'not_observed'
    )
  ),
  drop constraint if exists property_assessments_service_scope_array_check,
  add constraint property_assessments_service_scope_array_check check (
    jsonb_typeof(service_scope) = 'array'
    and jsonb_array_length(service_scope) <= 50
  ),
  drop constraint if exists property_assessments_scope_exception_length_check,
  add constraint property_assessments_scope_exception_length_check check (
    length(coalesce(scope_exception, '')) <= 1200
  );

create or replace function public.commit_visit_field_record(
  p_field_record_id uuid,
  p_property_id uuid,
  p_appointment_id uuid,
  p_technician_name text,
  p_visit_date date,
  p_customer_note text,
  p_internal_note text,
  p_follow_up_needed boolean,
  p_scope_read_state text,
  p_service_scope jsonb,
  p_scope_exception text,
  p_assets jsonb
)
returns table(assessment_id uuid, asset_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  committed_assessment_id uuid;
  committed_asset_count integer;
  normalized_scope jsonb := coalesce(p_service_scope, '[]'::jsonb);
  normalized_exception text := nullif(trim(coalesce(p_scope_exception, '')), '');
  stored_scope_read_state text;
  stored_service_scope jsonb;
  stored_scope_exception text;
begin
  if p_scope_read_state is null
     or p_scope_read_state not in (
       'available', 'partial', 'permission_hidden', 'not_observed'
     )
     or jsonb_typeof(normalized_scope) <> 'array'
     or jsonb_array_length(normalized_scope) > 50
     or length(coalesce(p_scope_exception, '')) > 1200 then
    raise exception 'Invalid visit service scope input';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_scope) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(jsonb_typeof(item->'id'), '') <> 'string'
      or nullif(trim(coalesce(item->>'id', '')), '') is null
      or length(item->>'id') > 200
      or coalesce(jsonb_typeof(item->'name'), '') <> 'string'
      or nullif(trim(coalesce(item->>'name', '')), '') is null
      or length(item->>'name') > 180
      or (
        item ? 'description'
        and jsonb_typeof(item->'description') not in ('string', 'null')
      )
      or length(coalesce(item->>'description', '')) > 500
      or (
        item ? 'category'
        and jsonb_typeof(item->'category') not in ('string', 'null')
      )
      or length(coalesce(item->>'category', '')) > 80
      or coalesce(jsonb_typeof(item->'quantity'), '') <> 'number'
      or case
        when jsonb_typeof(item->'quantity') = 'number'
          then (item->>'quantity')::numeric < 0
            or (item->>'quantity')::numeric > 100000
        else true
      end
      or coalesce(jsonb_typeof(item->'completed'), '') <> 'boolean'
  ) then
    raise exception 'Invalid visit service scope item';
  end if;

  if (
    select count(*) <> count(distinct item->>'id')
    from jsonb_array_elements(normalized_scope) item
  ) then
    raise exception 'Duplicate visit service scope item';
  end if;

  if (
       p_scope_read_state in ('permission_hidden', 'not_observed')
       and jsonb_array_length(normalized_scope) > 0
     ) then
    raise exception 'Unavailable Jobber scope cannot contain service items';
  end if;

  if (
       p_scope_read_state in ('partial', 'permission_hidden', 'not_observed')
       or exists (
         select 1
         from jsonb_array_elements(normalized_scope) item
         where coalesce((item->>'completed')::boolean, false) is false
       )
     ) and normalized_exception is null then
    raise exception 'Unverified or unfinished service scope needs an exception';
  end if;

  if normalized_exception is not null and p_follow_up_needed is not true then
    raise exception 'Service scope exception must create a follow-up';
  end if;

  select result.assessment_id, result.asset_count
    into committed_assessment_id, committed_asset_count
  from public.commit_visit_field_record(
    p_field_record_id,
    p_property_id,
    p_appointment_id,
    p_technician_name,
    p_visit_date,
    p_customer_note,
    p_internal_note,
    p_follow_up_needed,
    p_assets
  ) result;

  select assessment.scope_read_state,
    assessment.service_scope,
    assessment.scope_exception
    into stored_scope_read_state,
      stored_service_scope,
      stored_scope_exception
  from public.property_assessments assessment
  where assessment.id = committed_assessment_id
  for update;

  if stored_scope_read_state is null then
    update public.property_assessments assessment
    set scope_read_state = p_scope_read_state,
        service_scope = normalized_scope,
        scope_exception = normalized_exception
    where assessment.id = committed_assessment_id;
  elsif stored_scope_read_state is distinct from p_scope_read_state
     or stored_service_scope is distinct from normalized_scope
     or stored_scope_exception is distinct from normalized_exception then
    raise exception 'Field record ID already has different service scope';
  end if;

  return query select committed_assessment_id, committed_asset_count;
end;
$$;

revoke all on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, text, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, text, jsonb, text, jsonb
) to service_role;

comment on function public.commit_visit_field_record(
  uuid, uuid, uuid, text, date, text, text, boolean, text, jsonb, text, jsonb
) is
  'Atomically records visit proof and the exact Jobber service-scope completion snapshot.';

comment on column public.property_assessments.service_scope is
  'Durable per-line-item closeout snapshot mirrored from Jobber; never a billing authorization.';
comment on column public.property_assessments.scope_exception is
  'Technician explanation for unfinished or unverified service scope; creates an HQ follow-up.';
