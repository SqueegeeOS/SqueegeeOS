\set ON_ERROR_STOP on

-- Run only against a disposable Supabase database after migrations 001-045.
-- Synthetic .invalid fixtures only; every write is rolled back.
begin;
\ir support/forbidden_domain_fingerprints.sql

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000145',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'coverage-resume-045@example.invalid', '',
  pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '00000000-0000-4000-8000-000000000145',
  'coverage-resume-045@example.invalid', 'operator', true
);
insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-account-045',
  'Disposable Jobber', 'not-a-real-token', 'not-a-real-token',
  pg_catalog.now() + interval '1 hour', '2025-04-16'
);

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'jobber_schedule_sync_work_items',
    'jobber_schedule_sync_request_attempts'
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = relation_name
        and relation.relrowsecurity
    ) then
      raise exception 'Migration 045 RLS is not enabled on %', relation_name;
    end if;
    if pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', relation_name), 'SELECT'
    ) or pg_catalog.has_table_privilege(
      'authenticated', pg_catalog.format('public.%I', relation_name), 'SELECT'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', relation_name), 'INSERT'
    ) or pg_catalog.has_table_privilege(
      'authenticated', pg_catalog.format('public.%I', relation_name), 'UPDATE'
    ) then
      raise exception 'Migration 045 browser role has table authority on %', relation_name;
    end if;
  end loop;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.start_or_resume_jobber_schedule_coverage_sync(uuid,text,uuid,timestamp with time zone,timestamp with time zone,text)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.reserve_jobber_schedule_coverage_attempt(uuid,uuid,bigint,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Migration 045 browser role executes a continuation RPC';
  end if;
end;
$$;

do $$
declare
  unexpected_count integer;
begin
  select pg_catalog.count(*)::integer into unexpected_count
  from pg_catalog.pg_policy policy
  join pg_catalog.pg_class relation on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in (
      'jobber_schedule_sync_work_items',
      'jobber_schedule_sync_request_attempts'
    );
  if unexpected_count <> 0 then
    raise exception 'Migration 045 created a browser-visible frontier policy';
  end if;

  with actual as (
    select relation.relname as table_name,
      case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
      acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) acl
    left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_schedule_sync_work_items',
        'jobber_schedule_sync_request_attempts'
      )
      and acl.grantee <> relation.relowner
  ), expected(table_name, grantee, privilege_type, is_grantable) as (
    values
      ('jobber_schedule_sync_work_items', 'service_role', 'SELECT', false),
      ('jobber_schedule_sync_request_attempts', 'service_role', 'SELECT', false)
  )
  select pg_catalog.count(*)::integer into unexpected_count
  from (
    select * from actual except select * from expected
    union all
    select * from expected except select * from actual
  ) difference;
  if unexpected_count <> 0 then
    raise exception 'Migration 045 frontier table ACL inventory is not exact';
  end if;

  with expected(function_name, argument_types, service_execute, security_definer) as (
    values
      ('assert_resumable_jobber_schedule_sync_owner', 'uuid, uuid, bigint, uuid', false, true),
      ('start_or_resume_jobber_schedule_coverage_sync', 'uuid, text, uuid, timestamp with time zone, timestamp with time zone, text', true, true),
      ('renew_resumable_jobber_schedule_coverage_sync_lease', 'uuid, uuid, bigint, uuid', true, true),
      ('reserve_jobber_schedule_coverage_attempt', 'uuid, uuid, bigint, uuid, uuid', true, true),
      ('record_jobber_schedule_coverage_overflow', 'uuid, uuid, bigint, uuid, uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone', true, true),
      ('record_jobber_schedule_coverage_leaf', 'uuid, uuid, bigint, uuid, uuid, text, jsonb', true, true),
      ('complete_resumable_jobber_schedule_coverage_pass', 'uuid, uuid, bigint, uuid, smallint, text, text, integer, integer, integer', true, true),
      ('pause_jobber_schedule_coverage_sync', 'uuid, uuid, bigint, uuid', true, true),
      ('mark_resumable_jobber_schedule_coverage_sync_partial', 'uuid, uuid, bigint, uuid, text, integer', true, true),
      ('finalize_resumable_jobber_schedule_coverage_sync', 'uuid, uuid, bigint, uuid, bigint', true, true),
      ('invalidate_jobber_visit_classification_on_manifest_omission', '', false, true),
      ('reject_jobber_schedule_sync_attempt_change', '', false, false),
      ('reject_jobber_schedule_sync_work_item_delete', '', false, false)
  ), actual as (
    select routine.proname as function_name,
      pg_catalog.oidvectortypes(routine.proargtypes) as argument_types,
      routine.prosecdef as security_definer,
      coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '') as config
    from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname in (select function_name from expected)
  )
  select pg_catalog.count(*)::integer into unexpected_count
  from expected
  full join actual using (function_name, argument_types)
  where expected.function_name is null
    or actual.function_name is null
    or actual.security_definer <> expected.security_definer
    or actual.config <> 'search_path=pg_catalog';
  if unexpected_count <> 0 then
    raise exception 'Migration 045 function signature or definition inventory is not exact';
  end if;

  with expected(function_name, argument_types, service_execute) as (
    values
      ('assert_resumable_jobber_schedule_sync_owner', 'uuid, uuid, bigint, uuid', false),
      ('start_or_resume_jobber_schedule_coverage_sync', 'uuid, text, uuid, timestamp with time zone, timestamp with time zone, text', true),
      ('renew_resumable_jobber_schedule_coverage_sync_lease', 'uuid, uuid, bigint, uuid', true),
      ('reserve_jobber_schedule_coverage_attempt', 'uuid, uuid, bigint, uuid, uuid', true),
      ('record_jobber_schedule_coverage_overflow', 'uuid, uuid, bigint, uuid, uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone', true),
      ('record_jobber_schedule_coverage_leaf', 'uuid, uuid, bigint, uuid, uuid, text, jsonb', true),
      ('complete_resumable_jobber_schedule_coverage_pass', 'uuid, uuid, bigint, uuid, smallint, text, text, integer, integer, integer', true),
      ('pause_jobber_schedule_coverage_sync', 'uuid, uuid, bigint, uuid', true),
      ('mark_resumable_jobber_schedule_coverage_sync_partial', 'uuid, uuid, bigint, uuid, text, integer', true),
      ('finalize_resumable_jobber_schedule_coverage_sync', 'uuid, uuid, bigint, uuid, bigint', true),
      ('invalidate_jobber_visit_classification_on_manifest_omission', '', false),
      ('reject_jobber_schedule_sync_attempt_change', '', false),
      ('reject_jobber_schedule_sync_work_item_delete', '', false)
  ), actual as (
    select routine.proname as function_name,
      pg_catalog.oidvectortypes(routine.proargtypes) as argument_types,
      case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
      acl.privilege_type, acl.is_grantable,
      acl.grantee = routine.proowner as is_owner
    from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
    ) acl
    left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
    where namespace.nspname = 'public'
      and routine.proname in (select function_name from expected)
  )
  select pg_catalog.count(*)::integer into unexpected_count
  from expected
  where (select pg_catalog.count(*) from actual
         where actual.function_name = expected.function_name
           and actual.argument_types = expected.argument_types
           and actual.is_owner
           and actual.privilege_type = 'EXECUTE'
           and not actual.is_grantable) <> 1
     or (select pg_catalog.count(*) from actual
         where actual.function_name = expected.function_name
           and actual.argument_types = expected.argument_types
           and not actual.is_owner) <> case when expected.service_execute then 1 else 0 end
     or (expected.service_execute and not exists (
          select 1 from actual
          where actual.function_name = expected.function_name
            and actual.argument_types = expected.argument_types
            and actual.grantee = 'service_role'
            and actual.privilege_type = 'EXECUTE'
            and not actual.is_grantable
        ));
  if unexpected_count <> 0 then
    raise exception 'Migration 045 function ACL inventory is not exact';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname in (
        'renew_resumable_jobber_schedule_coverage_sync_lease',
        'reserve_jobber_schedule_coverage_attempt',
        'record_jobber_schedule_coverage_overflow',
        'record_jobber_schedule_coverage_leaf',
        'complete_resumable_jobber_schedule_coverage_pass',
        'mark_resumable_jobber_schedule_coverage_sync_partial',
        'finalize_resumable_jobber_schedule_coverage_sync'
      )
      and position(
        'assert_resumable_jobber_schedule_sync_owner' in routine.prosrc
      ) = 0
  ) or exists (
    select 1 from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'pause_jobber_schedule_coverage_sync'
      and (
        position('acquisition_generation' in routine.prosrc) = 0
        or position('owner_token' in routine.prosrc) = 0
      )
  ) then
    raise exception 'Migration 045 mutation body omitted an acquisition fence';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'invalidate_jobber_visit_classification_on_manifest_omission'
      and position(
        'classification.scheduled_start >= new.window_start' in routine.prosrc
      ) > 0
      and position(
        'classification.scheduled_start < new.window_end' in routine.prosrc
      ) > 0
      and position(
        'expected exactly one bound authoritative appointment' in routine.prosrc
      ) > 0
  ) then
    raise exception 'Migration 045 manifest-omission function is not fail-closed and window-bound';
  end if;

  with expected(constraint_name) as (
    values
      ('jobber_schedule_sync_work_items_run_fk'),
      ('jobber_schedule_sync_work_items_pass_check'),
      ('jobber_schedule_sync_work_items_path_check'),
      ('jobber_schedule_sync_work_items_state_check'),
      ('jobber_schedule_sync_work_items_pkey'),
      ('jobber_schedule_sync_work_items_window_key'),
      ('jobber_schedule_sync_work_items_window_check'),
      ('jobber_schedule_sync_work_items_attempt_check'),
      ('jobber_schedule_sync_request_attempts_pkey'),
      ('jobber_schedule_sync_request_attempts_actor_fk'),
      ('jobber_schedule_sync_request_attempts_generation_check'),
      ('jobber_schedule_sync_request_attempts_work_fk'),
      ('jobber_schedule_sync_request_attempts_window_check')
  ), actual as (
    select constraint_row.conname as constraint_name
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class relation on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_schedule_sync_work_items',
        'jobber_schedule_sync_request_attempts'
      )
  )
  select pg_catalog.count(*)::integer into unexpected_count
  from (
    select * from actual except select * from expected
    union all
    select * from expected except select * from actual
  ) difference;
  if unexpected_count <> 0 then
    raise exception 'Migration 045 constraint inventory is not exact';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_schedule_sync_work_items',
        'jobber_schedule_sync_request_attempts',
        'jobber_schedule_sync_runs'
      )
      and not trigger_row.tgisinternal
      and (
        (relation.relname = 'jobber_schedule_sync_request_attempts'
          and trigger_row.tgname = 'jobber_schedule_sync_request_attempts_immutable'
          and trigger_row.tgtype = 27 and trigger_row.tgenabled = 'O')
        or (relation.relname = 'jobber_schedule_sync_work_items'
          and trigger_row.tgname = 'jobber_schedule_sync_work_items_no_delete'
          and trigger_row.tgtype = 11 and trigger_row.tgenabled = 'O')
        or (relation.relname = 'jobber_schedule_sync_runs'
          and trigger_row.tgname = 'jobber_visit_classifications_manifest_fence'
          and trigger_row.tgtype = 17 and trigger_row.tgenabled = 'O')
      )
  ) <> 3 then
    raise exception 'Migration 045 trigger inventory is not exact';
  end if;

  if exists (
    with legacy(signature) as (values
      ('public.begin_jobber_schedule_coverage_sync(uuid,text,uuid,timestamp with time zone,timestamp with time zone,text)'),
      ('public.renew_jobber_schedule_coverage_sync_lease(uuid)'),
      ('public.append_jobber_schedule_coverage_leaf(uuid,smallint,integer,timestamp with time zone,timestamp with time zone,text,jsonb)'),
      ('public.complete_jobber_schedule_coverage_pass(uuid,smallint,text,text,integer,integer,integer)'),
      ('public.finalize_jobber_schedule_coverage_sync(uuid,bigint)'),
      ('public.mark_jobber_schedule_coverage_sync_partial(uuid,text,integer)')
    ), checked_roles(role_name) as (values ('anon'), ('authenticated'), ('service_role'))
    select 1
    from legacy cross join checked_roles
    where pg_catalog.has_function_privilege(
      checked_roles.role_name, legacy.signature, 'EXECUTE'
    )
    union all
    select 1
    from legacy
    join pg_catalog.pg_proc routine
      on routine.oid = pg_catalog.to_regprocedure(legacy.signature)
    cross join lateral pg_catalog.aclexplode(
      coalesce(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
    ) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'Migration 045 retained effective access to a legacy unfenced mutator';
  end if;
end;
$$;

select pg_temp.capture_forbidden_domain_content('before');

-- The migration-039 manifest fence is narrowed and made atomic by migration
-- 045. All fixtures in this nested block are rolled back before the resumable
-- coverage fingerprint proof continues.
do $$
declare
  appointment_lifecycle_before jsonb;
  appointment_lifecycle_after jsonb;
begin
  begin
    insert into public.homeowners (id, slug, full_name, first_name, email)
    values (
      '00000000-0000-4000-8000-000000010145',
      'coverage-manifest-045-homeowner', 'Disposable Manifest',
      'Disposable', 'coverage-manifest-045@example.invalid'
    );
    insert into public.properties (
      id, homeowner_id, slug, name, address, city, state, zip
    ) values (
      '00000000-0000-4000-8000-000000010245',
      '00000000-0000-4000-8000-000000010145',
      'coverage-manifest-045-property', 'Disposable manifest property',
      '45 Manifest Way', 'Chico', 'CA', '95926'
    );
    insert into public.memberships (
      id, homeowner_id, property_id, plan_id, plan_name, price_display,
      billing_period, status, sales_tier, visit_price,
      payment_setup_completed_at
    ) values (
      '00000000-0000-4000-8000-000000010345',
      '00000000-0000-4000-8000-000000010145',
      '00000000-0000-4000-8000-000000010245',
      'disposable-manifest-045', 'Disposable manifest plan', '$245',
      'per visit', 'active', 'quarterly', 245, pg_catalog.now()
    );
    insert into public.signed_agreements (
      id, homeowner_id, property_id, membership_id, homeowner_slug,
      property_slug, homeowner_name, plan_id, plan_name, signature_method,
      signer_name, signed_at, status, storage_backend
    ) values (
      '00000000-0000-4000-8000-000000010445',
      '00000000-0000-4000-8000-000000010145',
      '00000000-0000-4000-8000-000000010245',
      '00000000-0000-4000-8000-000000010345',
      'coverage-manifest-045-homeowner', 'coverage-manifest-045-property',
      'Disposable Manifest', 'disposable-manifest-045',
      'Disposable manifest plan', 'typed', 'Disposable Manifest',
      pg_catalog.now(), 'complete', 'supabase'
    );
    update public.memberships
    set agreement_id = '00000000-0000-4000-8000-000000010445'
    where id = '00000000-0000-4000-8000-000000010345';
    insert into public.member_profiles (id, homeowner_id, membership_tier)
    values (
      '00000000-0000-4000-8000-000000010545',
      '00000000-0000-4000-8000-000000010145', 'premium'
    );
    insert into public.jobber_property_links (
      id, connection_id, external_property_id, property_id, membership_id,
      link_state, linked_by, link_reason, updated_at
    ) values (
      '00000000-0000-4000-8000-000000010645', 'squeegeeking',
      'property-manifest-045', '00000000-0000-4000-8000-000000010245',
      '00000000-0000-4000-8000-000000010345', 'active',
      '00000000-0000-4000-8000-000000000145',
      'Disposable manifest fence proof', '2025-12-31T00:00:00Z'
    );
    insert into public.jobber_visit_projections (
      id, connection_id, provider, external_visit_id, external_job_id,
      external_client_id, external_property_id, job_number, title, client_name,
      visit_status, job_status, is_complete, scheduled_start, completed_at,
      raw_payload, source_payload_hash, source_observed_at, last_seen_at
    ) values
      (
        '00000000-0000-4000-8000-000000010745', 'squeegeeking', 'jobber',
        'visit-outside-window-045', 'job-outside-window-045',
        'client-manifest-045', 'property-manifest-045', 451,
        'Outside half-open window', 'Disposable client', 'UPCOMING', 'OPEN',
        false, '2026-02-01T00:00:00Z', null,
        '{"id":"visit-outside-window-045"}'::jsonb, repeat('a', 64),
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010746', 'squeegeeking', 'jobber',
        'visit-included-045', 'job-included-045', 'client-manifest-045',
        'property-manifest-045', 452, 'Included in manifest',
        'Disposable client', 'UPCOMING', 'OPEN', false,
        '2026-01-10T00:00:00Z', null,
        '{"id":"visit-included-045"}'::jsonb, repeat('b', 64),
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010747', 'squeegeeking', 'jobber',
        'visit-omitted-045', 'job-omitted-045', 'client-manifest-045',
        'property-manifest-045', 453, 'Omitted in window',
        'Disposable client', 'UPCOMING', 'OPEN', false,
        '2026-01-11T00:00:00Z', null,
        '{"id":"visit-omitted-045"}'::jsonb, repeat('c', 64),
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
      );
    insert into public.jobber_visit_classifications (
      id, connection_id, external_visit_id, projection_id,
      source_payload_hash, source_observed_at, external_property_id,
      property_link_id, property_link_updated_at, membership_id, property_id,
      service_type, classification_state, decision_actor_id, decision_reason,
      projection_snapshot, scheduled_start, appointment_id, decided_at,
      approved_at, updated_at
    ) values
      (
        '00000000-0000-4000-8000-000000010845', 'squeegeeking',
        'visit-outside-window-045', '00000000-0000-4000-8000-000000010745',
        repeat('a', 64), '2026-01-01T00:00:00Z', 'property-manifest-045',
        '00000000-0000-4000-8000-000000010645', '2025-12-31T00:00:00Z',
        '00000000-0000-4000-8000-000000010345',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        'pending_review', '00000000-0000-4000-8000-000000000145',
        'Disposable outside-window approval', '{"fixture":"outside"}'::jsonb,
        '2026-02-01T00:00:00Z', null, '2026-01-01T00:00:00Z', null,
        '2026-01-01T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010846', 'squeegeeking',
        'visit-included-045', '00000000-0000-4000-8000-000000010746',
        repeat('b', 64), '2026-01-01T00:00:00Z', 'property-manifest-045',
        '00000000-0000-4000-8000-000000010645', '2025-12-31T00:00:00Z',
        '00000000-0000-4000-8000-000000010345',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        'pending_review', '00000000-0000-4000-8000-000000000145',
        'Disposable included approval', '{"fixture":"included"}'::jsonb,
        '2026-01-10T00:00:00Z', null, '2026-01-01T00:00:00Z', null,
        '2026-01-01T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010847', 'squeegeeking',
        'visit-omitted-045', '00000000-0000-4000-8000-000000010747',
        repeat('c', 64), '2026-01-01T00:00:00Z', 'property-manifest-045',
        '00000000-0000-4000-8000-000000010645', '2025-12-31T00:00:00Z',
        '00000000-0000-4000-8000-000000010345',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        'pending_review', '00000000-0000-4000-8000-000000000145',
        'Disposable omitted approval', '{"fixture":"omitted"}'::jsonb,
        '2026-01-11T00:00:00Z', null, '2026-01-01T00:00:00Z', null,
        '2026-01-01T00:00:00Z'
      );
    insert into public.member_appointments (
      id, member_profile_id, property_id, service_type, scheduled_at, status,
      provider, external_id, provenance_state, verification_state, match_state,
      matched_obligation_id, source_observed_at, source_payload_hash,
      jobber_visit_classification_id, jobber_connection_id,
      jobber_projection_id, jobber_property_link_id, jobber_membership_id,
      jobber_authority_state, jobber_property_link_updated_at
    ) values
      (
        '00000000-0000-4000-8000-000000010945',
        '00000000-0000-4000-8000-000000010545',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        '2026-02-01T00:00:00Z', 'scheduled', 'jobber',
        'visit-outside-window-045', 'provider_imported', 'verified', 'matched',
        null, '2026-01-01T00:00:00Z', repeat('a', 64),
        '00000000-0000-4000-8000-000000010845', 'squeegeeking',
        '00000000-0000-4000-8000-000000010745',
        '00000000-0000-4000-8000-000000010645',
        '00000000-0000-4000-8000-000000010345', 'approved',
        '2025-12-31T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010946',
        '00000000-0000-4000-8000-000000010545',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        '2026-01-10T00:00:00Z', 'scheduled', 'jobber',
        'visit-included-045', 'provider_imported', 'verified', 'matched', null,
        '2026-01-01T00:00:00Z', repeat('b', 64),
        '00000000-0000-4000-8000-000000010846', 'squeegeeking',
        '00000000-0000-4000-8000-000000010746',
        '00000000-0000-4000-8000-000000010645',
        '00000000-0000-4000-8000-000000010345', 'approved',
        '2025-12-31T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000010947',
        '00000000-0000-4000-8000-000000010545',
        '00000000-0000-4000-8000-000000010245', 'home_care_visit',
        '2026-01-11T00:00:00Z', 'scheduled', 'jobber',
        'visit-omitted-045', 'provider_imported', 'verified', 'matched', null,
        '2026-01-01T00:00:00Z', repeat('c', 64),
        '00000000-0000-4000-8000-000000010847', 'squeegeeking',
        '00000000-0000-4000-8000-000000010747',
        '00000000-0000-4000-8000-000000010645',
        '00000000-0000-4000-8000-000000010345', 'approved',
        '2025-12-31T00:00:00Z'
      );
    update public.jobber_visit_classifications
    set classification_state = 'approved', approved_at = '2026-01-01T00:00:00Z',
        appointment_id = case id
          when '00000000-0000-4000-8000-000000010845' then '00000000-0000-4000-8000-000000010945'::uuid
          when '00000000-0000-4000-8000-000000010846' then '00000000-0000-4000-8000-000000010946'::uuid
          when '00000000-0000-4000-8000-000000010847' then '00000000-0000-4000-8000-000000010947'::uuid
        end
    where id in (
      '00000000-0000-4000-8000-000000010845',
      '00000000-0000-4000-8000-000000010846',
      '00000000-0000-4000-8000-000000010847'
    );

    insert into public.jobber_schedule_sync_runs (
      id, connection_id, actor_id, status, window_start, window_end,
      graphql_version, expected_watermark_generation, request_count,
      leaf_count, visit_count
    ) values (
      '00000000-0000-4000-8000-000000011045', 'squeegeeking',
      '00000000-0000-4000-8000-000000000145', 'running',
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2025-04-16',
      0, 2, 1, 1
    );
    insert into public.jobber_schedule_sync_partitions (
      id, run_id, pass_number, leaf_index, window_start, window_end,
      observation_count, manifest_sha256
    ) values (
      '00000000-0000-4000-8000-000000011145',
      '00000000-0000-4000-8000-000000011045', 2, 0,
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 1, repeat('f', 64)
    );
    insert into public.jobber_visit_source_observations (
      run_id, partition_id, pass_number, external_visit_id,
      source_payload_hash, source_observed_at, source_payload
    ) values (
      '00000000-0000-4000-8000-000000011045',
      '00000000-0000-4000-8000-000000011145', 2,
      'visit-included-045', repeat('b', 64), '2026-01-01T00:00:00Z',
      '{"id":"visit-included-045"}'::jsonb
    );
    insert into public.jobber_schedule_sync_watermarks (
      connection_id, run_id, window_start, window_end, covered_at, generation
    ) values (
      'squeegeeking', '00000000-0000-4000-8000-000000011045',
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z',
      '2026-03-01T00:00:00Z', 1
    );

    perform pg_temp.capture_forbidden_domain_content(
      'manifest_omission_before'
    );
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', appointment.id,
          'member_profile_id', appointment.member_profile_id,
          'property_id', appointment.property_id,
          'service_type', appointment.service_type,
          'scheduled_at', appointment.scheduled_at,
          'status', appointment.status,
          'technician_name', appointment.technician_name,
          'notes', appointment.notes,
          'completed_at', appointment.completed_at,
          'created_at', appointment.created_at,
          'provider', appointment.provider,
          'external_id', appointment.external_id,
          'provenance_state', appointment.provenance_state,
          'matched_obligation_id', appointment.matched_obligation_id,
          'source_observed_at', appointment.source_observed_at,
          'source_payload_hash', appointment.source_payload_hash,
          'jobber_visit_classification_id',
            appointment.jobber_visit_classification_id,
          'jobber_connection_id', appointment.jobber_connection_id,
          'jobber_projection_id', appointment.jobber_projection_id,
          'jobber_property_link_id', appointment.jobber_property_link_id,
          'jobber_membership_id', appointment.jobber_membership_id,
          'jobber_property_link_updated_at',
            appointment.jobber_property_link_updated_at
        )
        order by appointment.id
      ),
      '[]'::jsonb
    ) into appointment_lifecycle_before
    from public.member_appointments appointment
    where appointment.id in (
      '00000000-0000-4000-8000-000000010945',
      '00000000-0000-4000-8000-000000010946',
      '00000000-0000-4000-8000-000000010947'
    );

    update public.jobber_schedule_sync_runs
    set status = 'complete', completed_at = '2026-03-01T00:00:00Z'
    where id = '00000000-0000-4000-8000-000000011045';

    if not exists (
      select 1 from public.jobber_visit_classifications classification
      join public.member_appointments appointment
        on appointment.id = classification.appointment_id
      where classification.id = '00000000-0000-4000-8000-000000010845'
        and classification.classification_state = 'approved'
        and appointment.jobber_authority_state = 'approved'
    ) then
      raise exception 'Migration 045 changed an out-of-window classification';
    end if;
    if not exists (
      select 1 from public.jobber_visit_classifications classification
      join public.member_appointments appointment
        on appointment.id = classification.appointment_id
      where classification.id = '00000000-0000-4000-8000-000000010846'
        and classification.classification_state = 'approved'
        and appointment.jobber_authority_state = 'approved'
    ) then
      raise exception 'Migration 045 changed a visit included in pass two';
    end if;
    if not exists (
      select 1 from public.jobber_visit_classifications classification
      join public.member_appointments appointment
        on appointment.id = classification.appointment_id
      where classification.id = '00000000-0000-4000-8000-000000010847'
        and classification.classification_state = 'pending_review'
        and appointment.jobber_authority_state = 'pending_review'
        and appointment.status = 'scheduled'
        and appointment.completed_at is null
        and appointment.matched_obligation_id is null
    ) or (
      select pg_catalog.count(*)
      from public.jobber_visit_classification_events event
      where event.classification_id = '00000000-0000-4000-8000-000000010847'
        and event.event_type = 'manifest_omission_invalidated'
    ) <> 1 then
      raise exception 'Migration 045 did not atomically demote one in-window omission';
    end if;

    update public.jobber_schedule_sync_runs
    set status = 'complete'
    where id = '00000000-0000-4000-8000-000000011045';
    if (
      select pg_catalog.count(*)
      from public.jobber_visit_classification_events event
      where event.classification_id = '00000000-0000-4000-8000-000000010847'
        and event.event_type = 'manifest_omission_invalidated'
    ) <> 1 then
      raise exception 'Migration 045 duplicated omission evidence on completion replay';
    end if;

    perform pg_temp.capture_forbidden_domain_content(
      'manifest_omission_after'
    );
    perform pg_temp.assert_forbidden_domain_content_unchanged(
      'manifest_omission_before', 'manifest_omission_after'
    );
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', appointment.id,
          'member_profile_id', appointment.member_profile_id,
          'property_id', appointment.property_id,
          'service_type', appointment.service_type,
          'scheduled_at', appointment.scheduled_at,
          'status', appointment.status,
          'technician_name', appointment.technician_name,
          'notes', appointment.notes,
          'completed_at', appointment.completed_at,
          'created_at', appointment.created_at,
          'provider', appointment.provider,
          'external_id', appointment.external_id,
          'provenance_state', appointment.provenance_state,
          'matched_obligation_id', appointment.matched_obligation_id,
          'source_observed_at', appointment.source_observed_at,
          'source_payload_hash', appointment.source_payload_hash,
          'jobber_visit_classification_id',
            appointment.jobber_visit_classification_id,
          'jobber_connection_id', appointment.jobber_connection_id,
          'jobber_projection_id', appointment.jobber_projection_id,
          'jobber_property_link_id', appointment.jobber_property_link_id,
          'jobber_membership_id', appointment.jobber_membership_id,
          'jobber_property_link_updated_at',
            appointment.jobber_property_link_updated_at
        )
        order by appointment.id
      ),
      '[]'::jsonb
    ) into appointment_lifecycle_after
    from public.member_appointments appointment
    where appointment.id in (
      '00000000-0000-4000-8000-000000010945',
      '00000000-0000-4000-8000-000000010946',
      '00000000-0000-4000-8000-000000010947'
    );
    if appointment_lifecycle_after is distinct from appointment_lifecycle_before
    then
      raise exception 'Migration 045 changed appointment lifecycle or provenance during omission demotion';
    end if;

    insert into public.jobber_visit_projections (
      id, connection_id, provider, external_visit_id, external_job_id,
      external_client_id, external_property_id, job_number, title, client_name,
      visit_status, job_status, is_complete, scheduled_start, completed_at,
      raw_payload, source_payload_hash, source_observed_at, last_seen_at
    ) values (
      '00000000-0000-4000-8000-000000010748', 'squeegeeking', 'jobber',
      'visit-binding-mismatch-045', 'job-binding-mismatch-045',
      'client-manifest-045', 'property-manifest-045', 454,
      'Binding mismatch', 'Disposable client', 'UPCOMING', 'OPEN', false,
      '2026-01-12T00:00:00Z', null,
      '{"id":"visit-binding-mismatch-045"}'::jsonb, repeat('d', 64),
      '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
    );
    insert into public.jobber_visit_classifications (
      id, connection_id, external_visit_id, projection_id,
      source_payload_hash, source_observed_at, external_property_id,
      property_link_id, property_link_updated_at, membership_id, property_id,
      service_type, classification_state, decision_actor_id, decision_reason,
      projection_snapshot, scheduled_start, appointment_id, decided_at,
      approved_at, updated_at
    ) values (
      '00000000-0000-4000-8000-000000010848', 'squeegeeking',
      'visit-binding-mismatch-045', '00000000-0000-4000-8000-000000010748',
      repeat('d', 64), '2026-01-01T00:00:00Z', 'property-manifest-045',
      '00000000-0000-4000-8000-000000010645', '2025-12-31T00:00:00Z',
      '00000000-0000-4000-8000-000000010345',
      '00000000-0000-4000-8000-000000010245', 'home_care_visit',
      'pending_review', '00000000-0000-4000-8000-000000000145',
      'Disposable mismatch approval', '{"fixture":"mismatch"}'::jsonb,
      '2026-01-12T00:00:00Z', null, '2026-01-01T00:00:00Z', null,
      '2026-01-01T00:00:00Z'
    );
    insert into public.member_appointments (
      id, member_profile_id, property_id, service_type, scheduled_at, status,
      provider, external_id, provenance_state, verification_state, match_state,
      matched_obligation_id, source_observed_at, source_payload_hash,
      jobber_visit_classification_id, jobber_connection_id,
      jobber_projection_id, jobber_property_link_id, jobber_membership_id,
      jobber_authority_state, jobber_property_link_updated_at
    ) values (
      '00000000-0000-4000-8000-000000010948',
      '00000000-0000-4000-8000-000000010545',
      '00000000-0000-4000-8000-000000010245', 'home_care_visit',
      '2026-01-12T00:00:00Z', 'scheduled', 'jobber',
      'visit-binding-mismatch-045', 'provider_imported', 'verified', 'matched',
      null, '2026-01-01T00:00:00Z', repeat('e', 64),
      '00000000-0000-4000-8000-000000010848', 'squeegeeking',
      '00000000-0000-4000-8000-000000010748',
      '00000000-0000-4000-8000-000000010645',
      '00000000-0000-4000-8000-000000010345', 'approved',
      '2025-12-31T00:00:00Z'
    );
    update public.jobber_visit_classifications
    set classification_state = 'approved',
        appointment_id = '00000000-0000-4000-8000-000000010948',
        approved_at = '2026-01-01T00:00:00Z'
    where id = '00000000-0000-4000-8000-000000010848';
    insert into public.jobber_schedule_sync_runs (
      id, connection_id, actor_id, status, window_start, window_end,
      graphql_version, expected_watermark_generation, request_count,
      leaf_count, visit_count
    ) values (
      '00000000-0000-4000-8000-000000011245', 'squeegeeking',
      '00000000-0000-4000-8000-000000000145', 'running',
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2025-04-16',
      1, 2, 1, 1
    );
    insert into public.jobber_schedule_sync_partitions (
      id, run_id, pass_number, leaf_index, window_start, window_end,
      observation_count, manifest_sha256
    ) values (
      '00000000-0000-4000-8000-000000011345',
      '00000000-0000-4000-8000-000000011245', 2, 0,
      '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 1, repeat('e', 64)
    );
    insert into public.jobber_visit_source_observations (
      run_id, partition_id, pass_number, external_visit_id,
      source_payload_hash, source_observed_at, source_payload
    ) values (
      '00000000-0000-4000-8000-000000011245',
      '00000000-0000-4000-8000-000000011345', 2,
      'visit-included-045', repeat('b', 64), '2026-01-01T00:00:00Z',
      '{"id":"visit-included-045"}'::jsonb
    );
    begin
      update public.jobber_schedule_sync_watermarks
      set run_id = '00000000-0000-4000-8000-000000011245',
          covered_at = '2026-03-02T00:00:00Z', generation = 2
      where connection_id = 'squeegeeking';
      update public.jobber_schedule_sync_runs
      set status = 'complete', completed_at = '2026-03-02T00:00:00Z'
      where id = '00000000-0000-4000-8000-000000011245';
      raise exception 'Migration 045 accepted a manifest binding mismatch';
    exception when others then
      if sqlerrm not like '%manifest_omission_binding_conflict:%' then
        raise;
      end if;
    end;
    if not exists (
      select 1 from public.jobber_schedule_sync_runs run
      where run.id = '00000000-0000-4000-8000-000000011245'
        and run.status = 'running' and run.completed_at is null
    ) or not exists (
      select 1 from public.jobber_schedule_sync_watermarks watermark
      where watermark.connection_id = 'squeegeeking'
        and watermark.run_id = '00000000-0000-4000-8000-000000011045'
        and watermark.generation = 1
    ) or not exists (
      select 1 from public.jobber_visit_classifications classification
      join public.member_appointments appointment
        on appointment.id = classification.appointment_id
      where classification.id = '00000000-0000-4000-8000-000000010848'
        and classification.classification_state = 'approved'
        and appointment.jobber_authority_state = 'approved'
        and appointment.source_payload_hash = repeat('e', 64)
    ) or exists (
      select 1 from public.jobber_visit_classification_events event
      where event.classification_id = '00000000-0000-4000-8000-000000010848'
        and event.event_type = 'manifest_omission_invalidated'
    ) then
      raise exception 'Migration 045 binding mismatch did not roll back atomically';
    end if;

    raise exception 'rollback_manifest_omission_fixtures_045';
  exception when others then
    if sqlerrm <> 'rollback_manifest_omission_fixtures_045' then raise; end if;
  end;
end;
$$;

-- An interrupted reservation remains immutable evidence. After lease expiry,
-- the same logical run is resumed and the exact in-progress window is replayed
-- under a new attempt reservation.
do $$
declare
  first_start jsonb;
  resumed_start jsonb;
  first_attempt jsonb;
  replay_attempt jsonb;
  pass_two_attempt jsonb;
  pass_result text;
  finalize_result text;
begin
  first_start := public.start_or_resume_jobber_schedule_coverage_sync(
    '00000000-0000-4000-8000-000000000245', 'squeegeeking',
    '00000000-0000-4000-8000-000000000145',
    '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
  );
  first_attempt := public.reserve_jobber_schedule_coverage_attempt(
    (first_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (first_start->>'acquisition_generation')::bigint,
    (first_start->>'owner_token')::uuid,
    '00000000-0000-4000-8000-000000000345'
  );
  update public.jobber_schedule_sync_locks
  set lease_expires_at = pg_catalog.now() - interval '1 second'
  where connection_id = 'squeegeeking';

  resumed_start := public.start_or_resume_jobber_schedule_coverage_sync(
    '00000000-0000-4000-8000-000000000445', 'squeegeeking',
    '00000000-0000-4000-8000-000000000145',
    '2026-04-18T07:00:00Z', '2027-07-18T07:00:00Z', '2025-04-16'
  );
  if resumed_start->>'outcome' <> 'resumed'
    or resumed_start->>'run_id' <> first_start->>'run_id'
    or resumed_start->>'window_start' <> first_start->>'window_start'
  then
    raise exception 'Migration 045 did not resume the same fixed logical run';
  end if;

  begin
    perform public.renew_resumable_jobber_schedule_coverage_sync_lease(
      (first_start->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (first_start->>'acquisition_generation')::bigint,
      (first_start->>'owner_token')::uuid
    );
    raise exception 'Stale worker unexpectedly renewed after takeover';
  exception when others then
    if sqlerrm not like '%ownership fence was lost%' then raise; end if;
  end;
  begin
    perform public.pause_jobber_schedule_coverage_sync(
      (first_start->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (first_start->>'acquisition_generation')::bigint,
      (first_start->>'owner_token')::uuid
    );
    raise exception 'Stale worker unexpectedly paused after takeover';
  exception when others then
    if sqlerrm not like '%ownership fence was lost%' then raise; end if;
  end;
  begin
    perform public.finalize_resumable_jobber_schedule_coverage_sync(
      (first_start->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (first_start->>'acquisition_generation')::bigint,
      (first_start->>'owner_token')::uuid, 0
    );
    raise exception 'Stale worker unexpectedly finalized after takeover';
  exception when others then
    if sqlerrm not like '%ownership fence was lost%' then raise; end if;
  end;
  begin
    perform public.mark_resumable_jobber_schedule_coverage_sync_partial(
      (first_start->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (first_start->>'acquisition_generation')::bigint,
      (first_start->>'owner_token')::uuid, 'storage_failure', 1
    );
    raise exception 'Stale worker unexpectedly marked partial after takeover';
  exception when others then
    if sqlerrm not like '%ownership fence was lost%' then raise; end if;
  end;
  if not exists (
    select 1 from public.jobber_schedule_sync_runs run
    where run.id = (resumed_start->>'run_id')::uuid
      and run.status = 'running'
  ) then
    raise exception 'Stale worker changed run status after takeover';
  end if;

  replay_attempt := public.reserve_jobber_schedule_coverage_attempt(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid,
    '00000000-0000-4000-8000-000000000545'
  );
  if replay_attempt->>'partition_path' <> first_attempt->>'partition_path'
    or replay_attempt->>'window_start' <> first_attempt->>'window_start'
    or replay_attempt->>'window_end' <> first_attempt->>'window_end'
  then
    raise exception 'Migration 045 did not replay interrupted in-progress work';
  end if;

  perform public.record_jobber_schedule_coverage_leaf(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid,
    (replay_attempt->>'attempt_id')::uuid, repeat('a', 64), '[]'::jsonb
  );
  pass_result := public.complete_resumable_jobber_schedule_coverage_pass(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid, 1::smallint,
    repeat('b', 64), repeat('c', 64), 1, 0, 2
  );
  if pass_result <> 'pass_two_ready' then
    raise exception 'Migration 045 did not transition durably to pass two';
  end if;

  pass_two_attempt := public.reserve_jobber_schedule_coverage_attempt(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid,
    '00000000-0000-4000-8000-000000000645'
  );
  perform public.record_jobber_schedule_coverage_leaf(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid,
    (pass_two_attempt->>'attempt_id')::uuid, repeat('a', 64), '[]'::jsonb
  );
  pass_result := public.complete_resumable_jobber_schedule_coverage_pass(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid, 2::smallint,
    repeat('b', 64), repeat('c', 64), 1, 0, 1
  );
  if pass_result <> 'ready_to_finalize' then
    raise exception 'Migration 045 pass two did not become finalizable';
  end if;
  if exists (
    select 1 from public.jobber_schedule_sync_watermarks
    where connection_id = 'squeegeeking'
  ) then
    raise exception 'Migration 045 advanced the watermark before finalization';
  end if;

  finalize_result := public.finalize_resumable_jobber_schedule_coverage_sync(
    (resumed_start->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed_start->>'acquisition_generation')::bigint,
    (resumed_start->>'owner_token')::uuid, 0
  );
  if finalize_result <> 'completed' then
    raise exception 'Migration 045 stable two-pass finalization failed';
  end if;
end;
$$;

-- Fourteen provider attempts are one invocation checkpoint, not terminal
-- partial state. Completed leaves remain complete and cannot be selected by a
-- resumed worker; a concurrent contender cannot acquire the same run.
do $$
declare
  started jsonb;
  attempt jsonb;
  resumed jsonb;
  concurrent_result jsonb;
  next_attempt jsonb;
  completed_path text;
  midpoint timestamptz;
  attempt_id uuid;
  index integer;
begin
  started := public.start_or_resume_jobber_schedule_coverage_sync(
    '00000000-0000-4000-8000-000000000745', 'squeegeeking',
    '00000000-0000-4000-8000-000000000145',
    '2026-04-17T07:00:00Z', '2027-07-17T07:00:00Z', '2025-04-16'
  );

  for index in 1..13 loop
    attempt_id := pg_catalog.gen_random_uuid();
    attempt := public.reserve_jobber_schedule_coverage_attempt(
      (started->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (started->>'acquisition_generation')::bigint,
      (started->>'owner_token')::uuid, attempt_id
    );
    midpoint := pg_catalog.to_timestamp(
      (
        pg_catalog.floor(
          extract(epoch from (attempt->>'window_start')::timestamptz) * 1000
        )::bigint + (
          pg_catalog.floor(
            extract(epoch from (attempt->>'window_end')::timestamptz) * 1000
          )::bigint - pg_catalog.floor(
            extract(epoch from (attempt->>'window_start')::timestamptz) * 1000
          )::bigint
        ) / 2
      )::numeric / 1000
    );
    perform public.record_jobber_schedule_coverage_overflow(
      (started->>'run_id')::uuid,
      '00000000-0000-4000-8000-000000000145',
      (started->>'acquisition_generation')::bigint,
      (started->>'owner_token')::uuid, attempt_id,
      (attempt->>'window_start')::timestamptz, midpoint,
      midpoint, (attempt->>'window_end')::timestamptz
    );
  end loop;

  attempt := public.reserve_jobber_schedule_coverage_attempt(
    (started->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (started->>'acquisition_generation')::bigint,
    (started->>'owner_token')::uuid,
    '00000000-0000-4000-8000-000000000845'
  );
  completed_path := attempt->>'partition_path';
  perform public.record_jobber_schedule_coverage_leaf(
    (started->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (started->>'acquisition_generation')::bigint,
    (started->>'owner_token')::uuid,
    (attempt->>'attempt_id')::uuid, repeat('d', 64), '[]'::jsonb
  );
  perform public.pause_jobber_schedule_coverage_sync(
    (started->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (started->>'acquisition_generation')::bigint,
    (started->>'owner_token')::uuid
  );
  if not exists (
    select 1 from public.jobber_schedule_sync_runs run
    where run.id = (started->>'run_id')::uuid
      and run.status = 'awaiting_continuation'
      and run.failure_code is null
      and run.completed_at is null
      and run.request_count = 14
  ) then
    raise exception 'Migration 045 did not checkpoint exactly fourteen attempts';
  end if;

  resumed := public.start_or_resume_jobber_schedule_coverage_sync(
    '00000000-0000-4000-8000-000000000945', 'squeegeeking',
    '00000000-0000-4000-8000-000000000145',
    '2026-04-18T07:00:00Z', '2027-07-18T07:00:00Z', '2025-04-16'
  );
  concurrent_result := public.start_or_resume_jobber_schedule_coverage_sync(
    '00000000-0000-4000-8000-000000001045', 'squeegeeking',
    '00000000-0000-4000-8000-000000000145',
    '2026-04-18T07:00:00Z', '2027-07-18T07:00:00Z', '2025-04-16'
  );
  if resumed->>'run_id' <> started->>'run_id'
    or concurrent_result->>'outcome' <> 'locked'
    or concurrent_result->>'run_id' <> started->>'run_id'
  then
    raise exception 'Migration 045 concurrent resume did not preserve one owner';
  end if;

  next_attempt := public.reserve_jobber_schedule_coverage_attempt(
    (resumed->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed->>'acquisition_generation')::bigint,
    (resumed->>'owner_token')::uuid,
    '00000000-0000-4000-8000-000000001145'
  );
  if next_attempt->>'partition_path' = completed_path then
    raise exception 'Migration 045 re-fetched an already completed leaf';
  end if;
  perform public.mark_resumable_jobber_schedule_coverage_sync_partial(
    (resumed->>'run_id')::uuid,
    '00000000-0000-4000-8000-000000000145',
    (resumed->>'acquisition_generation')::bigint,
    (resumed->>'owner_token')::uuid, 'storage_failure', 15
  );
end;
$$;

do $$
begin
  begin
    update public.jobber_schedule_sync_request_attempts
    set reserved_at = reserved_at + interval '1 second'
    where id = '00000000-0000-4000-8000-000000000345';
    raise exception 'Migration 045 immutable attempt unexpectedly changed';
  exception when others then
    if sqlerrm not like '%append-only and immutable%' then raise; end if;
  end;
end;
$$;

select pg_temp.capture_forbidden_domain_content('after');
select pg_temp.assert_forbidden_domain_content_unchanged('before', 'after');

rollback;
