begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000043',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'completion-043-race@example.invalid', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '10000000-0000-4000-8000-000000000043',
  'completion-043-race@example.invalid', 'operator', true
);

insert into public.homeowners (id, slug, full_name, first_name, email)
values (
  '20000000-0000-4000-8000-000000000043', 'completion-043-race-homeowner',
  'Disposable Completion Race', 'Disposable',
  'completion-043-race-member@example.invalid'
);
insert into public.properties (
  id, homeowner_id, slug, name, address, city, state, zip
) values (
  '30000000-0000-4000-8000-000000000043',
  '20000000-0000-4000-8000-000000000043',
  'completion-043-race-property', 'Disposable race property',
  '43 Race Way', 'Chico', 'CA', '95926'
);
insert into public.memberships (
  id, homeowner_id, property_id, plan_id, plan_name, price_display,
  billing_period, status, sales_tier, visit_price,
  payment_setup_completed_at
) values (
  '40000000-0000-4000-8000-000000000043',
  '20000000-0000-4000-8000-000000000043',
  '30000000-0000-4000-8000-000000000043',
  'disposable-race', 'Disposable race plan', '$243', 'per visit',
  'active', 'quarterly', 243, now()
);
insert into public.signed_agreements (
  id, homeowner_id, property_id, membership_id, homeowner_slug,
  property_slug, homeowner_name, plan_id, plan_name, signature_method,
  signer_name, signed_at, status, storage_backend
) values (
  '50000000-0000-4000-8000-000000000043',
  '20000000-0000-4000-8000-000000000043',
  '30000000-0000-4000-8000-000000000043',
  '40000000-0000-4000-8000-000000000043',
  'completion-043-race-homeowner', 'completion-043-race-property',
  'Disposable Completion Race', 'disposable-race', 'Disposable race plan',
  'typed', 'Disposable Completion Race', now(), 'complete', 'supabase'
);
update public.memberships
set agreement_id = '50000000-0000-4000-8000-000000000043'
where id = '40000000-0000-4000-8000-000000000043';
insert into public.member_profiles (id, homeowner_id, membership_tier)
values (
  '60000000-0000-4000-8000-000000000043',
  '20000000-0000-4000-8000-000000000043', 'premium'
);

insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-concurrency-043',
  'Disposable Jobber race', 'not-a-token', 'not-a-token',
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
  '70000000-0000-4000-8000-000000000043', 'squeegeeking', 'jobber',
  'visit-completion-043-race', 'job-completion-043-race',
  'client-completion-043-race', 'property-completion-043-race', 43,
  'Provider race evidence only', 'Disposable race client',
  'UPCOMING', 'OPEN', false, now() - interval '1 hour', null,
  '{"id":"visit-completion-043-race"}'::jsonb, repeat('a', 64),
  now() - interval '1 hour', now() - interval '1 hour'
);
insert into public.jobber_property_links (
  id, connection_id, external_property_id, property_id, membership_id,
  link_state, linked_by, link_reason, updated_at
) values (
  '80000000-0000-4000-8000-000000000043', 'squeegeeking',
  'property-completion-043-race',
  '30000000-0000-4000-8000-000000000043',
  '40000000-0000-4000-8000-000000000043', 'active',
  '10000000-0000-4000-8000-000000000043',
  'Disposable exact-property race review', now() - interval '1 hour'
);

insert into public.jobber_visit_classifications (
  id, connection_id, external_visit_id, projection_id, source_payload_hash,
  source_observed_at, external_property_id, property_link_id,
  property_link_updated_at, membership_id, property_id, service_type,
  classification_state, decision_actor_id, decision_reason,
  projection_snapshot, scheduled_start, appointment_id, decided_at,
  approved_at, updated_at
) values (
  '90000000-0000-4000-8000-000000000043', 'squeegeeking',
  'visit-completion-043-race',
  '70000000-0000-4000-8000-000000000043', repeat('a', 64),
  now() - interval '1 hour', 'property-completion-043-race',
  '80000000-0000-4000-8000-000000000043',
  (select updated_at from public.jobber_property_links
   where id = '80000000-0000-4000-8000-000000000043'),
  '40000000-0000-4000-8000-000000000043',
  '30000000-0000-4000-8000-000000000043', 'home_care_visit', 'approved',
  '10000000-0000-4000-8000-000000000043',
  'Disposable prior exact race approval',
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
  'a0000000-0000-4000-8000-000000000043',
  '60000000-0000-4000-8000-000000000043',
  '30000000-0000-4000-8000-000000000043', 'home_care_visit',
  now() - interval '1 hour', 'scheduled', 'jobber',
  'visit-completion-043-race', 'provider_imported', 'verified', 'matched',
  null, now() - interval '1 hour', repeat('a', 64),
  '90000000-0000-4000-8000-000000000043', 'squeegeeking',
  '70000000-0000-4000-8000-000000000043',
  '80000000-0000-4000-8000-000000000043',
  '40000000-0000-4000-8000-000000000043', 'approved',
  (select updated_at from public.jobber_property_links
   where id = '80000000-0000-4000-8000-000000000043')
);
update public.jobber_visit_classifications
set appointment_id = 'a0000000-0000-4000-8000-000000000043'
where id = '90000000-0000-4000-8000-000000000043';
insert into public.jobber_visit_classification_events (
  classification_id, event_type, actor_id, reason, projection_id,
  connection_id, external_visit_id, source_payload_hash, source_observed_at,
  external_property_id, property_link_id, property_link_updated_at,
  membership_id, property_id, service_type, scheduled_start, appointment_id,
  projection_snapshot, occurred_at
) values (
  '90000000-0000-4000-8000-000000000043', 'approved',
  '10000000-0000-4000-8000-000000000043',
  'Disposable prior race approval',
  '70000000-0000-4000-8000-000000000043', 'squeegeeking',
  'visit-completion-043-race', repeat('a', 64), now() - interval '1 hour',
  'property-completion-043-race',
  '80000000-0000-4000-8000-000000000043',
  (select updated_at from public.jobber_property_links
   where id = '80000000-0000-4000-8000-000000000043'),
  '40000000-0000-4000-8000-000000000043',
  '30000000-0000-4000-8000-000000000043', 'home_care_visit',
  now() - interval '1 hour', 'a0000000-0000-4000-8000-000000000043',
  '{"visit_status":"UPCOMING","is_complete":false}'::jsonb,
  now() - interval '1 hour'
);

update public.jobber_visit_projections
set visit_status = 'COMPLETED', is_complete = true,
    completed_at = pg_catalog.clock_timestamp() - interval '5 minutes',
    raw_payload = '{"id":"visit-completion-043-race","visitStatus":"COMPLETED","isComplete":true}'::jsonb,
    source_payload_hash = repeat('c', 64),
    source_observed_at = pg_catalog.clock_timestamp(),
    last_seen_at = pg_catalog.clock_timestamp()
where id = '70000000-0000-4000-8000-000000000043';

insert into public.jobber_schedule_sync_runs (
  id, connection_id, actor_id, status, window_start, window_end,
  graphql_version, expected_watermark_generation, request_count, leaf_count,
  visit_count, completed_at
) values (
  'b0000000-0000-4000-8000-000000000043', 'squeegeeking',
  '10000000-0000-4000-8000-000000000043', 'complete',
  now() - interval '90 days', now() + interval '365 days', '2025-04-16',
  0, 2, 1, 1, pg_catalog.clock_timestamp()
);
insert into public.jobber_schedule_sync_partitions (
  id, run_id, pass_number, leaf_index, window_start, window_end,
  observation_count, manifest_sha256
) values (
  'c0000000-0000-4000-8000-000000000043',
  'b0000000-0000-4000-8000-000000000043', 2, 0,
  now() - interval '90 days', now() + interval '365 days', 1,
  repeat('d', 64)
);
insert into public.jobber_visit_source_observations (
  run_id, partition_id, pass_number, external_visit_id,
  source_payload_hash, source_observed_at, source_payload
)
select
  'b0000000-0000-4000-8000-000000000043',
  'c0000000-0000-4000-8000-000000000043', 2, external_visit_id,
  source_payload_hash, source_observed_at, raw_payload
from public.jobber_visit_projections
where id = '70000000-0000-4000-8000-000000000043';
insert into public.jobber_schedule_sync_watermarks (
  connection_id, run_id, window_start, window_end, covered_at, generation
)
select connection_id, id, window_start, window_end, completed_at, 1
from public.jobber_schedule_sync_runs
where id = 'b0000000-0000-4000-8000-000000000043';

commit;
