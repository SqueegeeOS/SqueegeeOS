\set ON_ERROR_STOP on

-- Run only against a disposable Supabase database after migrations 001-043.
-- Synthetic .invalid fixtures only; every write is rolled back.
begin;
\ir support/forbidden_domain_fingerprints.sql

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000143',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'completion-043@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-4000-8000-000000001443',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'completion-043-second@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '00000000-0000-4000-8000-000000000143',
  'completion-043@example.invalid', 'operator', true
), (
  '00000000-0000-4000-8000-000000001443',
  'completion-043-second@example.invalid', 'operator', true
);

insert into public.homeowners (id, slug, full_name, first_name, email)
values (
  '00000000-0000-4000-8000-000000000243', 'completion-043-homeowner',
  'Disposable Completion', 'Disposable', 'member-completion-043@example.invalid'
);
insert into public.properties (
  id, homeowner_id, slug, name, address, city, state, zip
) values (
  '00000000-0000-4000-8000-000000000343',
  '00000000-0000-4000-8000-000000000243', 'completion-043-property',
  'Disposable property', '43 Test Way', 'Chico', 'CA', '95926'
);
insert into public.memberships (
  id, homeowner_id, property_id, plan_id, plan_name, price_display,
  billing_period, status, sales_tier, visit_price,
  payment_setup_completed_at
) values (
  '00000000-0000-4000-8000-000000000443',
  '00000000-0000-4000-8000-000000000243',
  '00000000-0000-4000-8000-000000000343',
  'disposable', 'Disposable plan', '$243', 'per visit', 'active',
  'quarterly', 243, now()
);
insert into public.signed_agreements (
  id, homeowner_id, property_id, membership_id, homeowner_slug,
  property_slug, homeowner_name, plan_id, plan_name, signature_method,
  signer_name, signed_at, status, storage_backend
) values (
  '00000000-0000-4000-8000-000000000543',
  '00000000-0000-4000-8000-000000000243',
  '00000000-0000-4000-8000-000000000343',
  '00000000-0000-4000-8000-000000000443',
  'completion-043-homeowner', 'completion-043-property',
  'Disposable Completion', 'disposable', 'Disposable plan', 'typed',
  'Disposable Completion', now(), 'complete', 'supabase'
);
update public.memberships
set agreement_id = '00000000-0000-4000-8000-000000000543'
where id = '00000000-0000-4000-8000-000000000443';
insert into public.member_profiles (id, homeowner_id, membership_tier)
values (
  '00000000-0000-4000-8000-000000000643',
  '00000000-0000-4000-8000-000000000243', 'premium'
);

insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-account-043',
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
  '00000000-0000-4000-8000-000000000743', 'squeegeeking', 'jobber',
  'visit-completion-043', 'job-completion-043', 'client-completion-043',
  'property-completion-043', 43, 'Provider evidence only',
  'Disposable client', 'UPCOMING', 'OPEN', false,
  now() - interval '1 hour', null, '{"id":"visit-completion-043"}'::jsonb,
  repeat('a', 64), now() - interval '1 hour', now() - interval '1 hour'
);
insert into public.jobber_property_links (
  id, connection_id, external_property_id, property_id, membership_id,
  link_state, linked_by, link_reason, updated_at
) values (
  '00000000-0000-4000-8000-000000000843', 'squeegeeking',
  'property-completion-043', '00000000-0000-4000-8000-000000000343',
  '00000000-0000-4000-8000-000000000443', 'active',
  '00000000-0000-4000-8000-000000000143',
  'Disposable exact-property review', now() - interval '1 hour'
);

insert into public.jobber_visit_classifications (
  id, connection_id, external_visit_id, projection_id, source_payload_hash,
  source_observed_at, external_property_id, property_link_id,
  property_link_updated_at, membership_id, property_id, service_type,
  classification_state, decision_actor_id, decision_reason,
  projection_snapshot, scheduled_start, appointment_id, decided_at,
  approved_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000943', 'squeegeeking',
  'visit-completion-043', '00000000-0000-4000-8000-000000000743',
  repeat('a', 64), now() - interval '1 hour', 'property-completion-043',
  '00000000-0000-4000-8000-000000000843',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000843'),
  '00000000-0000-4000-8000-000000000443',
  '00000000-0000-4000-8000-000000000343', 'home_care_visit', 'approved',
  '00000000-0000-4000-8000-000000000143',
  'Disposable prior exact approval',
  '{"visit_status":"UPCOMING","is_complete":false}'::jsonb,
  now() - interval '1 hour', null, now() - interval '1 hour',
  now() - interval '1 hour', now() - interval '1 hour'
);
insert into public.member_appointments (
  id, member_profile_id, property_id, service_type, scheduled_at, status,
  provider, external_id, provenance_state, verification_state, match_state,
  matched_obligation_id, source_observed_at, source_payload_hash,
  jobber_visit_classification_id, jobber_connection_id,
  jobber_projection_id, jobber_property_link_id, jobber_membership_id,
  jobber_authority_state, jobber_property_link_updated_at
) values (
  '00000000-0000-4000-8000-000000001043',
  '00000000-0000-4000-8000-000000000643',
  '00000000-0000-4000-8000-000000000343', 'home_care_visit',
  now() - interval '1 hour', 'scheduled', 'jobber', 'visit-completion-043',
  'provider_imported', 'verified', 'matched', null,
  now() - interval '1 hour', repeat('a', 64),
  '00000000-0000-4000-8000-000000000943', 'squeegeeking',
  '00000000-0000-4000-8000-000000000743',
  '00000000-0000-4000-8000-000000000843',
  '00000000-0000-4000-8000-000000000443', 'approved',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000843')
);
update public.jobber_visit_classifications
set appointment_id = '00000000-0000-4000-8000-000000001043'
where id = '00000000-0000-4000-8000-000000000943';
insert into public.jobber_visit_classification_events (
  classification_id, event_type, actor_id, reason, projection_id,
  connection_id, external_visit_id, source_payload_hash, source_observed_at,
  external_property_id, property_link_id, property_link_updated_at,
  membership_id, property_id, service_type, scheduled_start, appointment_id,
  projection_snapshot, occurred_at
) values (
  '00000000-0000-4000-8000-000000000943', 'approved',
  '00000000-0000-4000-8000-000000000143', 'Disposable prior approval',
  '00000000-0000-4000-8000-000000000743', 'squeegeeking',
  'visit-completion-043', repeat('a', 64), now() - interval '1 hour',
  'property-completion-043', '00000000-0000-4000-8000-000000000843',
  (select updated_at from public.jobber_property_links
   where id = '00000000-0000-4000-8000-000000000843'),
  '00000000-0000-4000-8000-000000000443',
  '00000000-0000-4000-8000-000000000343', 'home_care_visit',
  now() - interval '1 hour', '00000000-0000-4000-8000-000000001043',
  '{"visit_status":"UPCOMING","is_complete":false}'::jsonb,
  now() - interval '1 hour'
);

-- A later stable Jobber source changes the approved UPCOMING projection to
-- the exact verified COMPLETED contract. Migration 039's source fence must
-- demote the prior appointment/classification to pending review first.
update public.jobber_visit_projections
set visit_status = 'COMPLETED', is_complete = true,
    completed_at = pg_catalog.clock_timestamp() - interval '5 minutes',
    raw_payload = '{"id":"visit-completion-043","visitStatus":"COMPLETED","isComplete":true}'::jsonb,
    source_payload_hash = repeat('c', 64),
    source_observed_at = pg_catalog.clock_timestamp(),
    last_seen_at = pg_catalog.clock_timestamp()
where id = '00000000-0000-4000-8000-000000000743';

insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, request_count, leaf_count,
  visit_count, completed_at
) values (
  '00000000-0000-4000-8000-000000001143', 'squeegeeking',
  '00000000-0000-4000-8000-000000000143', 'complete',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  0, 2, 1, 1, pg_catalog.clock_timestamp()
);
insert into public.jobber_schedule_sync_partitions (
  id, run_id, pass_number, leaf_index, window_start, window_end,
  observation_count, manifest_sha256
) values (
  '00000000-0000-4000-8000-000000001243',
  '00000000-0000-4000-8000-000000001143', 2, 0,
  now() - interval '90 days', now() + interval '365 days', 1, repeat('d', 64)
);
insert into public.jobber_visit_source_observations (
  run_id, partition_id, pass_number, external_visit_id,
  source_payload_hash, source_observed_at, source_payload
)
select
  '00000000-0000-4000-8000-000000001143',
  '00000000-0000-4000-8000-000000001243', 2, external_visit_id,
  source_payload_hash, source_observed_at, raw_payload
from public.jobber_visit_projections
where id = '00000000-0000-4000-8000-000000000743';
insert into public.jobber_schedule_sync_watermarks (
  connection_id, run_id, window_start, window_end, covered_at, generation
)
select connection_id, id, window_start, window_end, completed_at, 1
from public.jobber_schedule_sync_runs
where id = '00000000-0000-4000-8000-000000001143';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jobber_visit_completion_events', 'visit_text_evidence'
  ] loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
    then
      raise exception 'Untrusted role unexpectedly has visit completion/evidence privilege';
    end if;
  end loop;
  if has_function_privilege('anon',
    'public.confirm_jobber_visit_completion(uuid,uuid,text,uuid,timestamp with time zone,timestamp with time zone,text,uuid)',
    'EXECUTE')
    or has_function_privilege('authenticated',
    'public.append_visit_text_evidence(uuid,uuid,text,uuid)', 'EXECUTE')
  then
    raise exception 'Untrusted role unexpectedly executes visit completion/evidence RPC';
  end if;
  if not has_function_privilege('service_role',
    'public.confirm_jobber_visit_completion(uuid,uuid,text,uuid,timestamp with time zone,timestamp with time zone,text,uuid)',
    'EXECUTE')
    or not has_function_privilege('service_role',
    'public.append_visit_text_evidence(uuid,uuid,text,uuid)', 'EXECUTE')
  then
    raise exception 'service_role cannot execute visit completion/evidence RPC';
  end if;
end;
$$;

do $$
declare
  reviewed_classification_updated_at timestamptz;
  reviewed_link_updated_at timestamptz;
begin
  select updated_at into reviewed_classification_updated_at
  from public.jobber_visit_classifications
  where id = '00000000-0000-4000-8000-000000000943';
  select updated_at into reviewed_link_updated_at
  from public.jobber_property_links
  where id = '00000000-0000-4000-8000-000000000843';

  begin
    update public.jobber_connections set status = 'disconnected'
    where id = 'squeegeeking';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Disconnected Jobber connection was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_connections set graphql_version = '2024-01-01'
    where id = 'squeegeeking';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Wrong Jobber connection GraphQL version was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_schedule_sync_runs set graphql_version = '2024-01-01'
    where id = '00000000-0000-4000-8000-000000001143';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Wrong coverage GraphQL provenance was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_visit_projections set visit_status = 'ACTIVE'
    where id = '00000000-0000-4000-8000-000000000743';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Unknown provider completion state was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_visit_projections set is_complete = false
    where id = '00000000-0000-4000-8000-000000000743';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Contradictory completion flag was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_visit_projections set completed_at = null
    where id = '00000000-0000-4000-8000-000000000743';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Missing completion timestamp was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('b', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Stale source hash was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_property_links
    set link_state = 'revoked', revoked_by = 'rehearsal',
        revoke_reason = 'rehearsal', revoked_at = now()
    where id = '00000000-0000-4000-8000-000000000843';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Revoked property link was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.memberships set status = 'paused'
    where id = '00000000-0000-4000-8000-000000000443';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Inactive membership was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;

  begin
    update public.jobber_schedule_sync_runs
    set completed_at = now() - interval '31 minutes'
    where id = '00000000-0000-4000-8000-000000001143';
    update public.jobber_schedule_sync_watermarks
    set covered_at = now() - interval '31 minutes'
    where connection_id = 'squeegeeking';
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', reviewed_classification_updated_at,
      reviewed_link_updated_at, 'Must fail',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Stale coverage was accepted';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;
end;
$$;

do $$
declare
  classification_updated_at timestamptz;
  link_updated_at timestamptz;
  appointments_before bigint;
  result jsonb;
begin
  select updated_at into classification_updated_at
  from public.jobber_visit_classifications
  where id = '00000000-0000-4000-8000-000000000943';
  select updated_at into link_updated_at
  from public.jobber_property_links
  where id = '00000000-0000-4000-8000-000000000843';
  select count(*) into appointments_before from public.member_appointments;
  perform pg_temp.capture_forbidden_domain_content('before');

  result := public.confirm_jobber_visit_completion(
    '00000000-0000-4000-8000-000000001043',
    '00000000-0000-4000-8000-000000000743', repeat('c', 64),
    '00000000-0000-4000-8000-000000000943', classification_updated_at,
    link_updated_at, '  Disposable supervised completion  ',
    '00000000-0000-4000-8000-000000000143');
  if result->>'outcome' <> 'completed' then
    raise exception 'Valid exact completion was not recorded';
  end if;
  result := public.confirm_jobber_visit_completion(
    '00000000-0000-4000-8000-000000001043',
    '00000000-0000-4000-8000-000000000743', repeat('c', 64),
    '00000000-0000-4000-8000-000000000943', classification_updated_at,
    link_updated_at, 'Disposable supervised completion',
    '00000000-0000-4000-8000-000000000143');
  if result->>'outcome' <> 'replay'
    or (select count(*) from public.jobber_visit_completion_events
        where appointment_id = '00000000-0000-4000-8000-000000001043') <> 1
  then
    raise exception 'Concurrent or replay completion duplicated authority evidence';
  end if;
  begin
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', classification_updated_at,
      link_updated_at, 'Different reason',
      '00000000-0000-4000-8000-000000000143');
    raise exception 'Completion replay accepted a different reason';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;
  begin
    perform public.confirm_jobber_visit_completion(
      '00000000-0000-4000-8000-000000001043',
      '00000000-0000-4000-8000-000000000743', repeat('c', 64),
      '00000000-0000-4000-8000-000000000943', classification_updated_at,
      link_updated_at, 'Disposable supervised completion',
      '00000000-0000-4000-8000-000000001443');
    raise exception 'Completion replay accepted a different actor';
  exception when others then
    if sqlerrm not like '%completion_conflict:%' then raise; end if;
  end;
  if (select count(*) from public.member_appointments) <> appointments_before then
    raise exception 'Completion created a second appointment';
  end if;

  perform pg_temp.capture_forbidden_domain_content('after');
  perform pg_temp.assert_forbidden_domain_content_unchanged('before', 'after');
end;
$$;

do $$
declare
  result jsonb;
begin
  if to_regprocedure(
    'public.append_visit_text_evidence(uuid,uuid,uuid,uuid,text,uuid)'
  ) is not null then
    raise exception 'Browser-selected evidence scope was possible';
  end if;
  result := public.append_visit_text_evidence(
    '00000000-0000-4000-8000-000000001343',
    '00000000-0000-4000-8000-000000001043',
    'Screens and sills were directly checked.',
    '00000000-0000-4000-8000-000000000143');
  if result->>'outcome' <> 'recorded' then
    raise exception 'Valid text evidence was not recorded';
  end if;
  result := public.append_visit_text_evidence(
    '00000000-0000-4000-8000-000000001343',
    '00000000-0000-4000-8000-000000001043',
    'Screens and sills were directly checked.',
    '00000000-0000-4000-8000-000000000143');
  if result->>'outcome' <> 'replay'
    or (select count(*) from public.visit_text_evidence
        where id = '00000000-0000-4000-8000-000000001343') <> 1
  then
    raise exception 'Text evidence replay duplicated immutable evidence';
  end if;
  begin
    update public.visit_text_evidence set evidence_text = 'rewritten'
    where id = '00000000-0000-4000-8000-000000001343';
    raise exception 'Text evidence mutation was accepted';
  exception when others then
    if sqlerrm not like '%append-only and immutable%' then raise; end if;
  end;
end;
$$;

rollback;
