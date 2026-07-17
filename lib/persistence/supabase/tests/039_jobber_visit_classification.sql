\set ON_ERROR_STOP on

-- Run only against a disposable Supabase database after migrations 001-039.
-- Synthetic .invalid fixtures only; every write is rolled back.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000139',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pr3-039@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '00000000-0000-4000-8000-000000000139',
  'pr3-039@example.invalid', 'operator', true
);

insert into public.homeowners (id, slug, full_name, first_name, email)
values (
  '00000000-0000-4000-8000-000000000239', 'pr3-039-homeowner',
  'Disposable PR3', 'Disposable', 'member-pr3-039@example.invalid'
);
insert into public.properties (
  id, homeowner_id, slug, name, address, city, state, zip
) values (
  '00000000-0000-4000-8000-000000000339',
  '00000000-0000-4000-8000-000000000239', 'pr3-039-property',
  'Disposable property', '39 Test Way', 'Chico', 'CA', '95926'
);
insert into public.memberships (
  id, homeowner_id, property_id, plan_id, plan_name, price_display,
  billing_period, status, sales_tier, visit_price,
  payment_setup_completed_at
) values (
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000239',
  '00000000-0000-4000-8000-000000000339',
  'disposable', 'Disposable plan', '$239', 'per visit', 'active',
  'quarterly', 239, now()
);
insert into public.signed_agreements (
  id, homeowner_id, property_id, membership_id, homeowner_slug,
  property_slug, homeowner_name, plan_id, plan_name, signature_method,
  signer_name, signed_at, status, storage_backend
) values (
  '00000000-0000-4000-8000-000000000539',
  '00000000-0000-4000-8000-000000000239',
  '00000000-0000-4000-8000-000000000339',
  '00000000-0000-4000-8000-000000000439',
  'pr3-039-homeowner', 'pr3-039-property', 'Disposable PR3',
  'disposable', 'Disposable plan', 'typed', 'Disposable PR3', now(),
  'complete', 'supabase'
);
update public.memberships
set agreement_id = '00000000-0000-4000-8000-000000000539'
where id = '00000000-0000-4000-8000-000000000439';
insert into public.member_profiles (id, homeowner_id, membership_tier)
values (
  '00000000-0000-4000-8000-000000000639',
  '00000000-0000-4000-8000-000000000239', 'premium'
);

insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-account-039',
  'Disposable Jobber', 'not-a-token', 'not-a-token',
  now() + interval '1 hour', '2025-04-16'
);
insert into public.jobber_schedule_sync_locks (connection_id)
values ('squeegeeking');
insert into public.jobber_visit_projections (
  id, connection_id, provider, external_visit_id, external_job_id,
  external_client_id, external_property_id, job_number, title, client_name,
  visit_status, job_status, is_complete, scheduled_start, completed_at,
  raw_payload, source_payload_hash, source_observed_at, last_seen_at
) values (
  '00000000-0000-4000-8000-000000000739', 'squeegeeking', 'jobber',
  'visit-pr3-039', 'job-pr3-039', 'client-pr3-039', 'property-pr3-039',
  39, 'Provider evidence only', 'Disposable client', 'UPCOMING', 'OPEN',
  false, now() + interval '7 days', null,
  '{"id":"visit-pr3-039"}'::jsonb, repeat('a', 64), now(), now()
), (
  '00000000-0000-4000-8000-000000000749', 'squeegeeking', 'jobber',
  'visit-omission-pr3-039', 'job-omission-pr3-039',
  'client-pr3-039', 'property-pr3-039', 49,
  'Provider omission evidence only', 'Disposable client', 'UPCOMING', 'OPEN',
  false, now() + interval '9 days', null,
  '{"id":"visit-omission-pr3-039"}'::jsonb, repeat('e', 64), now(), now()
);
insert into public.jobber_property_links (
  id, connection_id, external_property_id, property_id, membership_id,
  link_state, linked_by, link_reason, updated_at
) values (
  '00000000-0000-4000-8000-000000000839', 'squeegeeking',
  'property-pr3-039', '00000000-0000-4000-8000-000000000339',
  '00000000-0000-4000-8000-000000000439', 'active',
  '00000000-0000-4000-8000-000000000139',
  'Disposable exact-property review', now() - interval '1 minute'
);

insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, request_count, leaf_count,
  visit_count, completed_at
) values (
  '00000000-0000-4000-8000-000000000939', 'squeegeeking',
  '00000000-0000-4000-8000-000000000139', 'complete',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  0, 2, 2, 2, now()
);
insert into public.jobber_schedule_sync_partitions (
  id, run_id, pass_number, leaf_index, window_start, window_end,
  observation_count, manifest_sha256
) values (
  '00000000-0000-4000-8000-000000001039',
  '00000000-0000-4000-8000-000000000939', 2, 0,
  now() - interval '90 days', now() + interval '365 days', 2, repeat('b', 64)
);
insert into public.jobber_visit_source_observations (
  run_id, partition_id, pass_number, external_visit_id,
  source_payload_hash, source_observed_at, source_payload
)
select
  '00000000-0000-4000-8000-000000000939',
  '00000000-0000-4000-8000-000000001039', 2, external_visit_id,
  source_payload_hash, source_observed_at,
  jsonb_build_object('external_visit_id', external_visit_id)
from public.jobber_visit_projections
where id in (
  '00000000-0000-4000-8000-000000000739',
  '00000000-0000-4000-8000-000000000749'
);
insert into public.jobber_schedule_sync_watermarks (
  connection_id, run_id, window_start, window_end, covered_at, generation
) values (
  'squeegeeking', '00000000-0000-4000-8000-000000000939',
  now() - interval '90 days', now() + interval '365 days', now(), 1
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jobber_visit_classifications', 'jobber_visit_classification_events'
  ] loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
    then
      raise exception 'anon/authenticated unexpectedly has classification privilege';
    end if;
  end loop;
  if has_function_privilege(
    'anon',
    'public.decide_jobber_visit_classification(text,uuid,text,uuid,timestamp with time zone,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.decide_jobber_visit_classification(text,uuid,text,uuid,timestamp with time zone,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.revoke_jobber_visit_classification(uuid,timestamp with time zone,text,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.revoke_jobber_visit_classification(uuid,timestamp with time zone,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon/authenticated unexpectedly executes classification RPC';
  end if;
  if exists (
    select 1
    from pg_proc function_row
    cross join lateral aclexplode(
      coalesce(function_row.proacl, acldefault('f', function_row.proowner))
    ) function_acl
    where function_row.oid in (
      'public.decide_jobber_visit_classification(text,uuid,text,uuid,timestamp with time zone,uuid,uuid,text,text,uuid)'::regprocedure,
      'public.revoke_jobber_visit_classification(uuid,timestamp with time zone,text,uuid)'::regprocedure
    )
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC unexpectedly executes classification RPC';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.decide_jobber_visit_classification(text,uuid,text,uuid,timestamp with time zone,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.revoke_jobber_visit_classification(uuid,timestamp with time zone,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute classification RPC';
  end if;
  if has_table_privilege('anon', 'public.member_appointments', 'SELECT')
    or has_table_privilege('anon', 'public.member_appointments', 'INSERT')
    or has_table_privilege('authenticated', 'public.member_appointments', 'UPDATE')
  then
    raise exception 'anon/authenticated unexpectedly has appointment authority privilege';
  end if;
  if has_sequence_privilege(
    'anon', 'public.jobber_schedule_sync_reservation_sequence', 'USAGE'
  ) or has_sequence_privilege(
    'authenticated', 'public.jobber_schedule_sync_reservation_sequence', 'USAGE'
  ) or has_sequence_privilege(
    'service_role', 'public.jobber_schedule_sync_reservation_sequence', 'USAGE'
  ) then
    raise exception 'Untrusted role unexpectedly has sync reservation sequence privilege';
  end if;
end;
$$;

select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable exact visit approval',
  '00000000-0000-4000-8000-000000000139'
);
select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable exact visit approval',
  '00000000-0000-4000-8000-000000000139'
);

do $$
begin
  if (select count(*) from public.jobber_visit_classifications
      where external_visit_id = 'visit-pr3-039') <> 1
    or (select count(*) from public.member_appointments
        where provider = 'jobber' and external_id = 'visit-pr3-039') <> 1
    or (select count(*) from public.jobber_visit_classification_events
        where event_type = 'approved') <> 1
  then
    raise exception 'Replay created a duplicate classification or appointment';
  end if;
end;
$$;

do $$
begin
  begin
    update public.jobber_visit_classification_events
    set reason = 'tampered'
    where event_type = 'approved';
    raise exception 'Immutable classification evidence unexpectedly changed';
  exception when others then
    if sqlerrm not like '%append-only and immutable%' then raise; end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Stale source attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Stale source hash was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839', now() - interval '1 day',
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Stale link attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Stale property-link token was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;

update public.hq_admin_users
set active = false
where user_id = '00000000-0000-4000-8000-000000000139';
do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Inactive actor attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Inactive Headquarters actor was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;
update public.hq_admin_users
set active = true
where user_id = '00000000-0000-4000-8000-000000000139';

do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000009999',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Membership mismatch attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Membership mismatch was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;

update public.jobber_schedule_sync_watermarks
set covered_at = now() - interval '31 minutes'
where connection_id = 'squeegeeking';
update public.jobber_schedule_sync_runs
set completed_at = (
  select covered_at from public.jobber_schedule_sync_watermarks
  where connection_id = 'squeegeeking'
)
where id = '00000000-0000-4000-8000-000000000939';
do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Stale coverage attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Stale coverage was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;
update public.jobber_schedule_sync_watermarks
set covered_at = clock_timestamp()
where connection_id = 'squeegeeking';
update public.jobber_schedule_sync_runs
set completed_at = (
  select covered_at from public.jobber_schedule_sync_watermarks
  where connection_id = 'squeegeeking'
)
where id = '00000000-0000-4000-8000-000000000939';

select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000749', repeat('e', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable omission-fence approval',
  '00000000-0000-4000-8000-000000000139'
);

update public.member_appointments
set technician_name = 'Synthetic technician', notes = 'Synthetic note'
where provider = 'jobber' and external_id = 'visit-pr3-039';

do $$
declare
  old_link_updated_at timestamptz;
  old_source_payload_hash text;
  old_source_observed_at timestamptz;
  old_scheduled_at timestamptz;
begin
  begin
    select jobber_property_link_updated_at, source_payload_hash,
      source_observed_at, scheduled_at
    into strict old_link_updated_at, old_source_payload_hash,
      old_source_observed_at, old_scheduled_at
    from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039';

    update public.jobber_property_links
    set link_reason = 'Disposable same-home token refresh'
    where id = '00000000-0000-4000-8000-000000000839';

    perform public.decide_jobber_visit_classification(
      'reject', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Disposable rejection after same-home link token change',
      '00000000-0000-4000-8000-000000000139'
    );

    if not exists (
      select 1 from public.member_appointments
      where provider = 'jobber' and external_id = 'visit-pr3-039'
        and jobber_property_link_updated_at = old_link_updated_at
        and source_payload_hash = old_source_payload_hash
        and source_observed_at = old_source_observed_at
        and scheduled_at = old_scheduled_at
        and jobber_authority_state = 'pending_review'
        and jobber_visit_classification_id is null
        and technician_name = 'Synthetic technician'
        and notes = 'Synthetic note'
    ) or not exists (
      select 1 from public.jobber_visit_classifications
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and classification_state = 'rejected'
        and property_link_updated_at = (
          select updated_at from public.jobber_property_links
          where id = '00000000-0000-4000-8000-000000000839'
        )
        and appointment_id is null
    ) or not exists (
      select 1 from public.jobber_visit_classification_events
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and event_type = 'binding_detached'
        and property_link_updated_at = old_link_updated_at
        and appointment_id is not null
    ) or not exists (
      select 1 from public.jobber_visit_classification_events
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and event_type = 'rejected'
        and property_link_updated_at = (
          select updated_at from public.jobber_property_links
          where id = '00000000-0000-4000-8000-000000000839'
        )
        and appointment_id is null
    ) then
      raise exception 'Same-home link-token rejection rewrote or mispaired the prior appointment';
    end if;

    raise exception 'rollback_same_home_link_token_rejection';
  exception when others then
    if sqlerrm <> 'rollback_same_home_link_token_rejection' then raise; end if;
  end;
end;
$$;

insert into public.homeowners (id, slug, full_name, first_name, email)
values (
  '00000000-0000-4000-8000-000000002239', 'pr3-039-other-homeowner',
  'Disposable Other Home', 'Disposable', 'other-pr3-039@example.invalid'
);
insert into public.properties (
  id, homeowner_id, slug, name, address, city, state, zip
) values (
  '00000000-0000-4000-8000-000000002339',
  '00000000-0000-4000-8000-000000002239', 'pr3-039-other-property',
  'Disposable other property', '49 Test Way', 'Chico', 'CA', '95926'
);
insert into public.memberships (
  id, homeowner_id, property_id, plan_id, plan_name, price_display,
  billing_period, status, sales_tier, visit_price,
  payment_setup_completed_at
) values (
  '00000000-0000-4000-8000-000000002439',
  '00000000-0000-4000-8000-000000002239',
  '00000000-0000-4000-8000-000000002339',
  'disposable-other', 'Disposable other plan', '$249', 'per visit',
  'active', 'quarterly', 249, now()
);
insert into public.signed_agreements (
  id, homeowner_id, property_id, membership_id, homeowner_slug,
  property_slug, homeowner_name, plan_id, plan_name, signature_method,
  signer_name, signed_at, status, storage_backend
) values (
  '00000000-0000-4000-8000-000000002539',
  '00000000-0000-4000-8000-000000002239',
  '00000000-0000-4000-8000-000000002339',
  '00000000-0000-4000-8000-000000002439',
  'pr3-039-other-homeowner', 'pr3-039-other-property',
  'Disposable Other Home', 'disposable-other', 'Disposable other plan',
  'typed', 'Disposable Other Home', now(), 'complete', 'supabase'
);
update public.memberships
set agreement_id = '00000000-0000-4000-8000-000000002539'
where id = '00000000-0000-4000-8000-000000002439';
insert into public.member_profiles (id, homeowner_id, membership_tier)
values (
  '00000000-0000-4000-8000-000000002639',
  '00000000-0000-4000-8000-000000002239', 'premium'
);
insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'other-jobber-039', 'connected', 'other-disposable-account-039',
  'Other Disposable Jobber', 'not-a-token', 'not-a-token',
  now() + interval '1 hour', '2025-04-16'
);
insert into public.jobber_schedule_sync_locks (connection_id)
values ('other-jobber-039');
insert into public.jobber_visit_projections (
  id, connection_id, provider, external_visit_id, external_job_id,
  external_client_id, external_property_id, job_number, title, client_name,
  visit_status, job_status, is_complete, scheduled_start, completed_at,
  raw_payload, source_payload_hash, source_observed_at, last_seen_at
) values (
  '00000000-0000-4000-8000-000000002739', 'other-jobber-039', 'jobber',
  'visit-pr3-039', 'other-job-pr3-039', 'other-client-pr3-039',
  'other-property-pr3-039', 239, 'Conflicting provider identity',
  'Disposable other client', 'UPCOMING', 'OPEN', false,
  now() + interval '10 days', null, '{"id":"visit-pr3-039"}'::jsonb,
  repeat('f', 64), now(), now()
);
insert into public.jobber_property_links (
  id, connection_id, external_property_id, property_id, membership_id,
  link_state, linked_by, link_reason
) values (
  '00000000-0000-4000-8000-000000002839', 'other-jobber-039',
  'other-property-pr3-039', '00000000-0000-4000-8000-000000002339',
  '00000000-0000-4000-8000-000000002439', 'active',
  '00000000-0000-4000-8000-000000000139',
  'Disposable other exact-property review'
);
insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, request_count, leaf_count,
  visit_count, completed_at
) values (
  '00000000-0000-4000-8000-000000002939', 'other-jobber-039',
  '00000000-0000-4000-8000-000000000139', 'complete',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  0, 2, 2, 1, now()
);
insert into public.jobber_schedule_sync_partitions (
  id, run_id, pass_number, leaf_index, window_start, window_end,
  observation_count, manifest_sha256
) values (
  '00000000-0000-4000-8000-000000003039',
  '00000000-0000-4000-8000-000000002939', 2, 0,
  now() - interval '90 days', now() + interval '365 days', 1, repeat('f', 64)
);
insert into public.jobber_visit_source_observations (
  run_id, partition_id, pass_number, external_visit_id,
  source_payload_hash, source_observed_at, source_payload
)
select
  '00000000-0000-4000-8000-000000002939',
  '00000000-0000-4000-8000-000000003039', 2, external_visit_id,
  source_payload_hash, source_observed_at,
  jsonb_build_object('external_visit_id', external_visit_id)
from public.jobber_visit_projections
where id = '00000000-0000-4000-8000-000000002739';
insert into public.jobber_schedule_sync_watermarks (
  connection_id, run_id, window_start, window_end, covered_at, generation
) select
  'other-jobber-039', '00000000-0000-4000-8000-000000002939',
  window_start, window_end, completed_at, 1
from public.jobber_schedule_sync_runs
where id = '00000000-0000-4000-8000-000000002939';

do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('a', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000002439',
      '00000000-0000-4000-8000-000000002339', 'home_care_visit',
      'Same-connection same-ID different-home attempt',
      '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Same-connection same-ID appointment was rebound to another home';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000002739', repeat('f', 64),
      '00000000-0000-4000-8000-000000002839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000002839'),
      '00000000-0000-4000-8000-000000002439',
      '00000000-0000-4000-8000-000000002339', 'home_care_visit',
      'Cross-connection same-ID attempt',
      '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Cross-connection same-ID appointment was rebound';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
  if not exists (
    select 1 from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039'
      and property_id = '00000000-0000-4000-8000-000000000339'
      and technician_name = 'Synthetic technician'
      and notes = 'Synthetic note'
  ) then
    raise exception 'Same-ID conflict changed the existing appointment identity';
  end if;
end;
$$;

update public.jobber_visit_projections
set scheduled_start = now() + interval '8 days',
    raw_payload = '{"id":"visit-pr3-039","rescheduled":true}'::jsonb,
    source_payload_hash = repeat('c', 64),
    source_observed_at = clock_timestamp(), last_seen_at = clock_timestamp()
where id = '00000000-0000-4000-8000-000000000739';

insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, request_count, leaf_count,
  visit_count, completed_at
) values (
  '00000000-0000-4000-8000-000000001139', 'squeegeeking',
  '00000000-0000-4000-8000-000000000139', 'running',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  1, 2, 2, 1, null
);
insert into public.jobber_schedule_sync_partitions (
  id, run_id, pass_number, leaf_index, window_start, window_end,
  observation_count, manifest_sha256
) values (
  '00000000-0000-4000-8000-000000001239',
  '00000000-0000-4000-8000-000000001139', 2, 0,
  now() - interval '90 days', now() + interval '365 days', 1, repeat('d', 64)
);
insert into public.jobber_visit_source_observations (
  run_id, partition_id, pass_number, external_visit_id,
  source_payload_hash, source_observed_at, source_payload
)
select
  '00000000-0000-4000-8000-000000001139',
  '00000000-0000-4000-8000-000000001239', 2, external_visit_id,
  source_payload_hash, source_observed_at,
  jsonb_build_object('external_visit_id', external_visit_id)
from public.jobber_visit_projections
where id = '00000000-0000-4000-8000-000000000739';
update public.jobber_schedule_sync_watermarks
set run_id = '00000000-0000-4000-8000-000000001139',
    covered_at = clock_timestamp(), generation = 2
where connection_id = 'squeegeeking';
update public.jobber_schedule_sync_runs
set status = 'complete',
    completed_at = (
      select covered_at from public.jobber_schedule_sync_watermarks
      where connection_id = 'squeegeeking'
    )
where id = '00000000-0000-4000-8000-000000001139';

do $$
begin
  if exists (
    select 1 from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-omission-pr3-039'
      and jobber_authority_state = 'approved'
  ) or not exists (
    select 1 from public.jobber_visit_classifications
    where external_visit_id = 'visit-omission-pr3-039'
      and classification_state = 'pending_review'
  ) or not exists (
    select 1 from public.jobber_visit_classification_events
    where external_visit_id = 'visit-omission-pr3-039'
      and event_type = 'manifest_omission_invalidated'
  ) then
    raise exception 'Current complete manifest omission left appointment authoritative';
  end if;
end;
$$;

select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable reschedule reapproval',
  '00000000-0000-4000-8000-000000000139'
);

do $$
begin
  if (select count(*) from public.member_appointments
      where provider = 'jobber' and external_id = 'visit-pr3-039') <> 1
    or (select source_payload_hash from public.member_appointments
        where provider = 'jobber' and external_id = 'visit-pr3-039') <> repeat('c', 64)
    or (select technician_name from public.member_appointments
        where provider = 'jobber' and external_id = 'visit-pr3-039') <> 'Synthetic technician'
    or (select notes from public.member_appointments
        where provider = 'jobber' and external_id = 'visit-pr3-039') <> 'Synthetic note'
  then
    raise exception 'Source change duplicated, commandeered, or cleared existing appointment detail';
  end if;
end;
$$;

do $$
declare
  old_source_payload_hash text;
  old_source_observed_at timestamptz;
  old_scheduled_at timestamptz;
  old_link_updated_at timestamptz;
  changed_source_observed_at timestamptz := clock_timestamp();
begin
  begin
    select source_payload_hash, source_observed_at, scheduled_at,
      jobber_property_link_updated_at
    into strict old_source_payload_hash, old_source_observed_at,
      old_scheduled_at, old_link_updated_at
    from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039';

    update public.jobber_visit_projections
    set scheduled_start = now() + interval '10 days',
        raw_payload = '{"id":"visit-pr3-039","rescheduled_twice":true}'::jsonb,
        source_payload_hash = repeat('7', 64),
        source_observed_at = changed_source_observed_at,
        last_seen_at = changed_source_observed_at
    where id = '00000000-0000-4000-8000-000000000739';

    insert into public.jobber_schedule_sync_runs (
      id, connection_id, actor_id, status, window_start, window_end,
      graphql_version, expected_watermark_generation
    )
    select
      '00000000-0000-4000-8000-000000006139', watermark.connection_id,
      '00000000-0000-4000-8000-000000000139', 'running',
      watermark.window_start, watermark.window_end, '2025-04-16',
      watermark.generation
    from public.jobber_schedule_sync_watermarks watermark
    where watermark.connection_id = 'squeegeeking';
    insert into public.jobber_schedule_sync_partitions (
      id, run_id, pass_number, leaf_index, window_start, window_end,
      observation_count, manifest_sha256
    )
    select
      '00000000-0000-4000-8000-000000006239',
      '00000000-0000-4000-8000-000000006139', 2, 0,
      watermark.window_start, watermark.window_end, 1, repeat('7', 64)
    from public.jobber_schedule_sync_watermarks watermark
    where watermark.connection_id = 'squeegeeking';
    insert into public.jobber_visit_source_observations (
      run_id, partition_id, pass_number, external_visit_id,
      source_payload_hash, source_observed_at, source_payload
    )
    select
      '00000000-0000-4000-8000-000000006139',
      '00000000-0000-4000-8000-000000006239', 2, external_visit_id,
      source_payload_hash, source_observed_at,
      jsonb_build_object('external_visit_id', external_visit_id)
    from public.jobber_visit_projections
    where id = '00000000-0000-4000-8000-000000000739';
    update public.jobber_schedule_sync_watermarks
    set run_id = '00000000-0000-4000-8000-000000006139',
        covered_at = clock_timestamp(), generation = generation + 1
    where connection_id = 'squeegeeking';
    update public.jobber_schedule_sync_runs
    set status = 'complete',
        completed_at = (
          select covered_at from public.jobber_schedule_sync_watermarks
          where connection_id = 'squeegeeking'
        )
    where id = '00000000-0000-4000-8000-000000006139';

    perform public.decide_jobber_visit_classification(
      'reject', '00000000-0000-4000-8000-000000000739', repeat('7', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000000439',
      '00000000-0000-4000-8000-000000000339', 'home_care_visit',
      'Disposable rejection after same-home source reschedule',
      '00000000-0000-4000-8000-000000000139'
    );

    if not exists (
      select 1 from public.member_appointments
      where provider = 'jobber' and external_id = 'visit-pr3-039'
        and source_payload_hash = old_source_payload_hash
        and source_observed_at = old_source_observed_at
        and scheduled_at = old_scheduled_at
        and jobber_property_link_updated_at = old_link_updated_at
        and jobber_authority_state = 'pending_review'
        and jobber_visit_classification_id is null
        and technician_name = 'Synthetic technician'
        and notes = 'Synthetic note'
    ) or not exists (
      select 1 from public.jobber_visit_classifications
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and classification_state = 'rejected'
        and source_payload_hash = repeat('7', 64)
        and scheduled_start = now() + interval '10 days'
        and appointment_id is null
    ) or not exists (
      select 1 from public.jobber_visit_classification_events
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and event_type = 'binding_detached'
        and source_payload_hash = old_source_payload_hash
        and source_observed_at = old_source_observed_at
        and scheduled_start = old_scheduled_at
        and appointment_id is not null
    ) or not exists (
      select 1 from public.jobber_visit_classification_events
      where connection_id = 'squeegeeking'
        and external_visit_id = 'visit-pr3-039'
        and event_type = 'rejected'
        and source_payload_hash = repeat('7', 64)
        and source_observed_at = changed_source_observed_at
        and appointment_id is null
    ) then
      raise exception 'Same-home source-change rejection rewrote or mispaired the prior appointment';
    end if;

    raise exception 'rollback_same_home_source_rejection';
  exception when others then
    if sqlerrm <> 'rollback_same_home_source_rejection' then raise; end if;
  end;
end;
$$;

update public.jobber_property_links
set link_state = 'revoked',
    revoked_by = '00000000-0000-4000-8000-000000000139',
    revoke_reason = 'Disposable revocation', revoked_at = now()
where id = '00000000-0000-4000-8000-000000000839';

do $$
begin
  if exists (
    select 1 from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039'
      and jobber_authority_state = 'approved'
  ) then
    raise exception 'Property-link revocation left appointment authoritative';
  end if;
  if not exists (
    select 1 from public.jobber_visit_classification_events
    where event_type = 'approved'
  ) or not exists (
    select 1 from public.jobber_visit_classification_events
    where event_type = 'property_link_invalidated'
  ) then
    raise exception 'Classification revocation deleted decision evidence';
  end if;
end;
$$;

update public.jobber_property_links
set link_state = 'active',
    linked_by = '00000000-0000-4000-8000-000000000139',
    link_reason = 'Disposable re-review', linked_at = now(),
    revoked_by = null, revoke_reason = null, revoked_at = null
where id = '00000000-0000-4000-8000-000000000839';

select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable exact visit reapproval',
  '00000000-0000-4000-8000-000000000139'
);
update public.member_appointments
set source_payload_hash = repeat('d', 64)
where provider = 'jobber' and external_id = 'visit-pr3-039';
do $$
begin
  begin
    perform public.revoke_jobber_visit_classification(
      (select id from public.jobber_visit_classifications
       where external_visit_id = 'visit-pr3-039'),
      (select updated_at from public.jobber_visit_classifications
       where external_visit_id = 'visit-pr3-039'),
      'Disposable drifted-authority revocation',
      '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Drifted appointment authority was revoked';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
  if not exists (
    select 1 from public.jobber_visit_classifications
    where external_visit_id = 'visit-pr3-039'
      and classification_state = 'approved'
  ) or not exists (
    select 1 from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039'
      and source_payload_hash = repeat('d', 64)
      and jobber_authority_state = 'approved'
      and technician_name = 'Synthetic technician'
      and notes = 'Synthetic note'
  ) or exists (
    select 1 from public.jobber_visit_classification_events
    where event_type = 'revoked'
  ) then
    raise exception 'Failed revocation changed classification, appointment, or evidence';
  end if;
end;
$$;
update public.member_appointments
set source_payload_hash = repeat('c', 64)
where provider = 'jobber' and external_id = 'visit-pr3-039';
select public.revoke_jobber_visit_classification(
  (select id from public.jobber_visit_classifications
   where external_visit_id = 'visit-pr3-039'),
  (select updated_at from public.jobber_visit_classifications
   where external_visit_id = 'visit-pr3-039'),
  'Disposable classification revocation',
  '00000000-0000-4000-8000-000000000139'
);

do $$
begin
  if not exists (
    select 1 from public.jobber_visit_classifications
    where external_visit_id = 'visit-pr3-039'
      and classification_state = 'revoked'
  ) or not exists (
    select 1 from public.jobber_visit_classification_events
    where event_type = 'revoked'
  ) or (select count(*) from public.jobber_visit_classification_events
        where classification_id = (
          select id from public.jobber_visit_classifications
          where external_visit_id = 'visit-pr3-039'
        )) < 4
  then
    raise exception 'Classification revocation deleted decision evidence';
  end if;
end;
$$;

select public.decide_jobber_visit_classification(
  'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000000439',
  '00000000-0000-4000-8000-000000000339', 'home_care_visit',
  'Disposable approval before different-home relink',
  '00000000-0000-4000-8000-000000000139'
);
update public.jobber_property_links
set link_state = 'revoked',
    revoked_by = '00000000-0000-4000-8000-000000000139',
    revoke_reason = 'Disposable relink preparation', revoked_at = now()
where id = '00000000-0000-4000-8000-000000000839';
update public.jobber_property_links
set property_id = '00000000-0000-4000-8000-000000002339',
    membership_id = '00000000-0000-4000-8000-000000002439',
    link_state = 'active',
    linked_by = '00000000-0000-4000-8000-000000000139',
    link_reason = 'Disposable different-home relink', linked_at = now(),
    revoked_by = null, revoke_reason = null, revoked_at = null
where id = '00000000-0000-4000-8000-000000000839';
select public.decide_jobber_visit_classification(
  'reject', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
  '00000000-0000-4000-8000-000000000839',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000839'),
  '00000000-0000-4000-8000-000000002439',
  '00000000-0000-4000-8000-000000002339', 'home_care_visit',
  'Disposable rejection after different-home relink',
  '00000000-0000-4000-8000-000000000139'
);

do $$
begin
  if not exists (
    select 1 from public.member_appointments
    where provider = 'jobber' and external_id = 'visit-pr3-039'
      and property_id = '00000000-0000-4000-8000-000000000339'
      and jobber_membership_id = '00000000-0000-4000-8000-000000000439'
      and jobber_authority_state = 'pending_review'
      and jobber_visit_classification_id is null
      and technician_name = 'Synthetic technician'
      and notes = 'Synthetic note'
  ) or not exists (
    select 1 from public.jobber_visit_classifications
    where connection_id = 'squeegeeking'
      and external_visit_id = 'visit-pr3-039'
      and membership_id = '00000000-0000-4000-8000-000000002439'
      and property_id = '00000000-0000-4000-8000-000000002339'
      and classification_state = 'rejected'
      and appointment_id is null
  ) or not exists (
    select 1 from public.jobber_visit_classification_events
    where connection_id = 'squeegeeking'
      and external_visit_id = 'visit-pr3-039'
      and event_type = 'binding_detached'
      and membership_id = '00000000-0000-4000-8000-000000000439'
      and property_id = '00000000-0000-4000-8000-000000000339'
      and appointment_id is not null
  ) or not exists (
    select 1 from public.jobber_visit_classification_events
    where connection_id = 'squeegeeking'
      and external_visit_id = 'visit-pr3-039'
      and event_type = 'rejected'
      and membership_id = '00000000-0000-4000-8000-000000002439'
      and property_id = '00000000-0000-4000-8000-000000002339'
      and appointment_id is null
  ) or exists (
    select 1
    from public.member_appointments appointment
    join public.jobber_visit_classifications classification
      on classification.id = appointment.jobber_visit_classification_id
    where appointment.provider = 'jobber'
      and appointment.external_id = 'visit-pr3-039'
      and appointment.property_id = '00000000-0000-4000-8000-000000000339'
      and classification.property_id = '00000000-0000-4000-8000-000000002339'
  ) then
    raise exception 'Rejection after different-home relink mutated or mispaired the prior appointment';
  end if;
end;
$$;

insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, started_at
) values (
  '00000000-0000-4000-8000-000000005139', 'squeegeeking',
  '00000000-0000-4000-8000-000000000139', 'running',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  2, now() - interval '2 days'
);
update public.jobber_schedule_sync_locks
set active_run_id = '00000000-0000-4000-8000-000000005139',
    acquired_at = now() - interval '20 minutes',
    lease_expires_at = now() - interval '10 minutes'
where connection_id = 'squeegeeking';
do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000002439',
      '00000000-0000-4000-8000-000000002339', 'home_care_visit',
      'Expired unfinished reservation attempt',
      '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Expired unfinished sync reservation was ignored';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;
update public.jobber_schedule_sync_runs
set status = 'partial', failure_code = 'storage_failure', completed_at = now()
where id = '00000000-0000-4000-8000-000000005139';
update public.jobber_schedule_sync_locks
set active_run_id = null, acquired_at = null, lease_expires_at = null
where connection_id = 'squeegeeking';
do $$
begin
  begin
    perform public.decide_jobber_visit_classification(
      'approve', '00000000-0000-4000-8000-000000000739', repeat('c', 64),
      '00000000-0000-4000-8000-000000000839',
      (select updated_at from public.jobber_property_links
       where id = '00000000-0000-4000-8000-000000000839'),
      '00000000-0000-4000-8000-000000002439',
      '00000000-0000-4000-8000-000000002339', 'home_care_visit',
      'Partial coverage attempt', '00000000-0000-4000-8000-000000000139'
    );
    raise exception 'Causally later partial coverage was accepted';
  exception when others then
    if sqlerrm not like '%classification_conflict:%' then raise; end if;
  end;
end;
$$;

-- The exact connection sync-row lock, Headquarters actor FOR SHARE lock,
-- global provider/external advisory lock, and exact appointment-binding checks
-- fence concurrent reservations, deactivation, and approvals. True two-session
-- approval-vs-begin/finalize, approval-vs-link/source invalidation,
-- approval-vs-deactivation, revoke-vs-deactivation, and cross-connection
-- provider-identity rehearsals remain external release gates.
rollback;
