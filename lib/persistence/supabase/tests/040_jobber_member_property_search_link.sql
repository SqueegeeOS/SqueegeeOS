\set ON_ERROR_STOP on

-- Run only against a disposable Supabase database after migrations 001-040.
-- Synthetic .invalid fixtures only; every write is rolled back.
begin;
\ir support/forbidden_domain_fingerprints.sql

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000140',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'link-040@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-4000-8000-000000001140',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'link-040-inactive@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.hq_admin_users (user_id, email, role, active)
values (
  '00000000-0000-4000-8000-000000000140',
  'link-040@example.invalid', 'operator', true
), (
  '00000000-0000-4000-8000-000000001140',
  'link-040-inactive@example.invalid', 'operator', false
);

insert into public.homeowners (id, slug, full_name, first_name, email)
values (
  '00000000-0000-4000-8000-000000000240', 'link-040-homeowner-a',
  'Disposable Link A', 'Disposable', 'link-040-member-a@example.invalid'
), (
  '00000000-0000-4000-8000-000000001240', 'link-040-homeowner-b',
  'Disposable Link B', 'Disposable', 'link-040-member-b@example.invalid'
);
insert into public.properties (
  id, homeowner_id, slug, name, address, city, state, zip
) values (
  '00000000-0000-4000-8000-000000000340',
  '00000000-0000-4000-8000-000000000240', 'link-040-property-a',
  'Disposable property A', '40 Test Way', 'Chico', 'CA', '95926'
), (
  '00000000-0000-4000-8000-000000001340',
  '00000000-0000-4000-8000-000000001240', 'link-040-property-b',
  'Disposable property B', '41 Test Way', 'Chico', 'CA', '95926'
);
insert into public.memberships (
  id, homeowner_id, property_id, plan_id, plan_name, price_display,
  billing_period, status, sales_tier, visit_price,
  payment_setup_completed_at
) values (
  '00000000-0000-4000-8000-000000000440',
  '00000000-0000-4000-8000-000000000240',
  '00000000-0000-4000-8000-000000000340',
  'disposable-a', 'Disposable plan A', '$240', 'per visit', 'active',
  'quarterly', 240, now()
), (
  '00000000-0000-4000-8000-000000001440',
  '00000000-0000-4000-8000-000000001240',
  '00000000-0000-4000-8000-000000001340',
  'disposable-b', 'Disposable plan B', '$241', 'per visit', 'active',
  'biannual', 241, now()
);
insert into public.signed_agreements (
  id, homeowner_id, property_id, membership_id, homeowner_slug,
  property_slug, homeowner_name, plan_id, plan_name, signature_method,
  signer_name, signed_at, status, storage_backend
) values (
  '00000000-0000-4000-8000-000000000540',
  '00000000-0000-4000-8000-000000000240',
  '00000000-0000-4000-8000-000000000340',
  '00000000-0000-4000-8000-000000000440',
  'link-040-homeowner-a', 'link-040-property-a', 'Disposable Link A',
  'disposable-a', 'Disposable plan A', 'typed', 'Disposable Link A',
  now(), 'complete', 'supabase'
), (
  '00000000-0000-4000-8000-000000001540',
  '00000000-0000-4000-8000-000000001240',
  '00000000-0000-4000-8000-000000001340',
  '00000000-0000-4000-8000-000000001440',
  'link-040-homeowner-b', 'link-040-property-b', 'Disposable Link B',
  'disposable-b', 'Disposable plan B', 'typed', 'Disposable Link B',
  now(), 'pending', 'supabase'
);
update public.memberships
set agreement_id = case id
  when '00000000-0000-4000-8000-000000000440' then
    '00000000-0000-4000-8000-000000000540'::uuid
  else '00000000-0000-4000-8000-000000001540'::uuid
end
where id in (
  '00000000-0000-4000-8000-000000000440',
  '00000000-0000-4000-8000-000000001440'
);

insert into public.jobber_connections (
  id, status, account_id, account_name, access_token_ciphertext,
  refresh_token_ciphertext, access_token_expires_at, graphql_version
) values (
  'squeegeeking', 'connected', 'disposable-account-040',
  'Disposable Jobber', 'not-a-token', 'not-a-token',
  now() + interval '1 hour', '2025-04-16'
);

do $$
declare
  rpc regprocedure := pg_catalog.to_regprocedure(
    'public.link_jobber_member_property_from_search(uuid,text,text,text,text,text,timestamp with time zone,integer,boolean,uuid,boolean)'
  );
  rpc_owner oid;
  relation_row record;
  available_privilege text;
begin
  if rpc is null then
    raise exception 'Migration 040 link RPC is missing';
  end if;
  if has_function_privilege('anon', rpc, 'EXECUTE')
    or has_function_privilege('authenticated', rpc, 'EXECUTE')
    or not has_function_privilege('service_role', rpc, 'EXECUTE')
  then
    raise exception 'Migration 040 link RPC privileges are unsafe';
  end if;
  select proowner into strict rpc_owner from pg_catalog.pg_proc where oid = rpc;
  if (
    select count(*)
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) function_acl
    where function_row.oid = rpc
      and function_acl.privilege_type = 'EXECUTE'
  ) <> 2 or exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) function_acl
    where function_row.oid = rpc
      and function_acl.privilege_type = 'EXECUTE'
      and function_acl.grantee not in (
        rpc_owner,
        (select oid from pg_catalog.pg_roles where rolname = 'service_role')
      )
  ) then
    raise exception 'Migration 040 link RPC ACL is not exact';
  end if;
  if (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_property_links', 'jobber_property_link_events'
      )
      and relation.relrowsecurity
  ) <> 2 then
    raise exception 'Migration 040 authority tables must retain RLS';
  end if;
  for relation_row in
    select relation.oid, relation.relacl, relation.relowner
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_property_links', 'jobber_property_link_events'
      )
  loop
    for available_privilege in
      select distinct default_acl.privilege_type
      from pg_catalog.aclexplode(
        pg_catalog.acldefault('r', relation_row.relowner)
      ) default_acl
    loop
      if pg_catalog.has_table_privilege(
        'anon', relation_row.oid, available_privilege
      ) or pg_catalog.has_table_privilege(
        'authenticated', relation_row.oid, available_privilege
      ) or pg_catalog.has_table_privilege(
        'service_role', relation_row.oid, available_privilege
      ) is distinct from (available_privilege = 'SELECT') then
        raise exception 'Migration 040 authority table ACLs are not exact';
      end if;
    end loop;
  end loop;
  if exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) relation_acl
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_property_links', 'jobber_property_link_events'
      )
      and (
        relation_acl.grantee = 0
        or relation_acl.grantee in (
          select oid from pg_catalog.pg_roles
          where rolname in ('anon', 'authenticated')
        )
        or (
          relation_acl.grantee = (
            select oid from pg_catalog.pg_roles where rolname = 'service_role'
          )
          and (
            relation_acl.privilege_type <> 'SELECT'
            or relation_acl.is_grantable
          )
        )
      )
  ) or (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) relation_acl
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_property_links', 'jobber_property_link_events'
      )
      and relation_acl.grantee = (
        select oid from pg_catalog.pg_roles where rolname = 'service_role'
      )
      and relation_acl.privilege_type = 'SELECT'
      and not relation_acl.is_grantable
  ) <> 2 then
    raise exception 'Migration 040 authority table ACLs are not exact';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'jobber_property_links', 'jobber_property_link_events'
      )
      and exists (
        select 1
        from pg_catalog.unnest(policy.polroles) policy_role(role_oid)
        where policy_role.role_oid = 0
          or pg_catalog.pg_has_role('anon', policy_role.role_oid, 'MEMBER')
          or pg_catalog.pg_has_role(
            'authenticated', policy_role.role_oid, 'MEMBER'
          )
      )
  ) then
    raise exception 'Migration 040 authority tables expose a PUBLIC/browser policy';
  end if;
end;
$$;

do $$
declare
  first_observed_at timestamptz := pg_catalog.clock_timestamp() - interval '2 minutes';
  newer_observed_at timestamptz := pg_catalog.clock_timestamp() - interval '1 minute';
  stale_observed_at timestamptz := pg_catalog.clock_timestamp() - interval '3 minutes';
  first_result jsonb;
  replay_result jsonb;
  stale_result jsonb;
  linked_id uuid;
  authority_after_replay jsonb;
begin
  perform pg_temp.capture_forbidden_domain_content('before');

  first_result := public.link_jobber_member_property_from_search(
    '00000000-0000-4000-8000-000000000140', 'squeegeeking',
    'jobber-client-040-a', 'jobber-property-040-a',
    'https://secure.getjobber.com/properties/040-a', '2025-04-16',
    first_observed_at, 2, true,
    '00000000-0000-4000-8000-000000000440', true
  );
  if first_result->>'outcome' <> 'linked' then
    raise exception 'Migration 040 did not create the supervised link';
  end if;
  linked_id := (first_result->>'link_id')::uuid;

  replay_result := public.link_jobber_member_property_from_search(
    '00000000-0000-4000-8000-000000000140', 'squeegeeking',
    'jobber-client-040-a', 'jobber-property-040-a',
    'https://secure.getjobber.com/properties/040-a', '2025-04-16',
    newer_observed_at, 3, true,
    '00000000-0000-4000-8000-000000000440', true
  );
  if replay_result->>'outcome' <> 'already_linked'
    or (replay_result->>'link_id')::uuid <> linked_id
    or not exists (
      select 1 from public.jobber_property_links link
      where link.id = linked_id
        and link.ownership_observed_at = newer_observed_at
        and link.ownership_pages_scanned = 3
        and link.property_coverage_complete is true
    )
  then
    raise exception 'Migration 040 exact replay did not converge and refresh proof';
  end if;

  stale_result := public.link_jobber_member_property_from_search(
    '00000000-0000-4000-8000-000000000140', 'squeegeeking',
    'jobber-client-040-a', 'jobber-property-040-a',
    'https://secure.getjobber.com/properties/040-a', '2025-04-16',
    stale_observed_at, 1, true,
    '00000000-0000-4000-8000-000000000440', true
  );
  if stale_result->>'outcome' <> 'already_linked'
    or (select ownership_observed_at from public.jobber_property_links
        where id = linked_id) <> newer_observed_at
    or (select count(*) from public.jobber_property_link_events
        where link_id = linked_id and event_type = 'ownership_verified') <> 2
  then
    raise exception 'Migration 040 stale replay regressed current proof or lost evidence';
  end if;

  select pg_catalog.jsonb_build_object(
    'link', (select pg_catalog.to_jsonb(link) from public.jobber_property_links link
      where link.id = linked_id),
    'events', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(event) order by event.occurred_at, event.id)
      from public.jobber_property_link_events event where event.link_id = linked_id)
  ) into authority_after_replay;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000001140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-b',
      'https://secure.getjobber.com/properties/040-b', '2025-04-16',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Inactive Headquarters actor was accepted';
  exception when others then
    if sqlerrm not like 'jobber_link_forbidden:%' then raise; end if;
  end;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-b',
      'https://secure.getjobber.com/properties/040-b', '2025-04-16',
      newer_observed_at, 1, false,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Incomplete provider property coverage was accepted';
  exception when others then
    if sqlerrm not like 'jobber_link_invalid:%' then raise; end if;
  end;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-b',
      'https://secure.getjobber.com/properties/040-b', '2024-01-01',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Changed Jobber GraphQL version was accepted';
  exception when others then
    if sqlerrm not like 'jobber_link_conflict:%' then raise; end if;
  end;

  begin
    update public.memberships set status = 'paused'
    where id = '00000000-0000-4000-8000-000000001440';
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-b',
      'https://secure.getjobber.com/properties/040-b', '2025-04-16',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Paused membership was accepted';
  exception when others then
    if sqlerrm not like 'jobber_link_conflict:%' then raise; end if;
  end;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-b',
      'https://secure.getjobber.com/properties/040-b', '2025-04-16',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Incomplete signed agreement was accepted';
  exception when others then
    if sqlerrm not like 'jobber_link_conflict:%' then raise; end if;
  end;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-b', 'jobber-property-040-a',
      'https://secure.getjobber.com/properties/040-a', '2025-04-16',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000001440', true
    );
    raise exception 'Existing Jobber property was rebound to another home';
  exception when others then
    if sqlerrm not like 'jobber_link_conflict:%' then raise; end if;
  end;

  begin
    perform public.link_jobber_member_property_from_search(
      '00000000-0000-4000-8000-000000000140', 'squeegeeking',
      'jobber-client-040-a', 'jobber-property-040-other',
      'https://secure.getjobber.com/properties/040-other', '2025-04-16',
      newer_observed_at, 1, true,
      '00000000-0000-4000-8000-000000000440', true
    );
    raise exception 'Existing HomeAtlas property was linked to another Jobber property';
  exception when others then
    if sqlerrm not like 'jobber_link_conflict:%' then raise; end if;
  end;

  if authority_after_replay is distinct from pg_catalog.jsonb_build_object(
    'link', (select pg_catalog.to_jsonb(link) from public.jobber_property_links link
      where link.id = linked_id),
    'events', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(event) order by event.occurred_at, event.id)
      from public.jobber_property_link_events event where event.link_id = linked_id)
  ) then
    raise exception 'Migration 040 rejected input wrote link authority';
  end if;

  begin
    update public.jobber_property_link_events set reason = 'tampered'
    where link_id = linked_id;
    raise exception 'Immutable property-link evidence unexpectedly changed';
  exception when others then
    if sqlerrm not like '%append-only and immutable%' then raise; end if;
  end;
  begin
    delete from public.jobber_property_links where id = linked_id;
    raise exception 'Supervised property link was destructively deleted';
  exception when others then
    if sqlerrm not like '%must be revoked, never deleted%' then raise; end if;
  end;

  perform pg_temp.capture_forbidden_domain_content('after');
  perform pg_temp.assert_forbidden_domain_content_unchanged('before', 'after');
end;
$$;

rollback;
