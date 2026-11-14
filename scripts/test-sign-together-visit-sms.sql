-- Run on a disposable/preview database AFTER the migration, as a migration admin.
-- No providers or outbound-message rows are touched. All fixtures roll back.
-- With psql use: psql -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f this-file.sql
-- A failure aborts this transaction: ROLLBACK before reusing the connection.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

create function pg_temp.expect_sms_failure(command text, expected text)
returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if position(expected in sqlerrm) > 0 then return; end if;
    raise;
  end;
  raise exception 'Expected failure did not occur: %', expected;
end;
$$;

create temporary table sms_fixtures (n integer primary key, h uuid, c uuid, a uuid, phone text);
insert into sms_fixtures
select n, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '+1202555010' || n
from generate_series(1, 7) n;

do $$
begin
  if exists (select 1 from public.customer_contact_points p join sms_fixtures f
    on p.address_normalized = f.phone where p.channel = 'sms') then
    raise exception 'Reserved test phone already exists; refusing to touch it';
  end if;
end;
$$;

insert into public.homeowners (id, slug, full_name, first_name, phone)
select h, 'sms-test-' || h, 'Synthetic SMS Test', 'Synthetic',
  case when n = 5 then '+12025550199' else null end from sms_fixtures;
insert into public.customer_conversations (id, homeowner_id, subject)
select c, h, 'Synthetic rollback-only consent test' from sms_fixtures;
insert into public.signed_agreements (
  id, homeowner_id, homeowner_slug, property_slug, homeowner_name, plan_id, plan_name,
  signature_method, signer_name, signature_image_url, signed_at, status, ip_address,
  user_agent, visit_sms_opt_in, visit_sms_phone, visit_sms_disclosure_version
)
select a, h, 'sms-test-' || h, 'synthetic-no-property', 'Synthetic SMS Test',
  'synthetic', 'Synthetic', 'drawn', 'Synthetic SMS Test',
  case when n = 7 then null else 'data:image/png;base64,c3ludGhldGlj' end,
  '2026-01-02T03:04:05Z', case when n = 6 then 'pending' else 'complete' end,
  '192.0.2.10', 'SyntheticOriginalSigner/1.0', n <> 2,
  case when n <> 2 then phone end,
  case when n <> 2 then 'sign-together-visit-reminders-v1' end
from sms_fixtures;

-- Existing STOP and another customer's ownership must never be overwritten.
insert into public.customer_contact_points (
  homeowner_id, channel, address_normalized, is_primary, consent_status,
  consent_recorded_at, opt_out_reason
)
select h, 'sms', phone, true, 'opted_out', now(), 'STOP' from sms_fixtures where n = 3;
insert into public.customer_contact_points (homeowner_id, channel, address_normalized)
select owner.h, 'sms', target.phone from sms_fixtures owner cross join sms_fixtures target
where owner.n = 7 and target.n = 4;

do $$
declare f record; other_c uuid; count_events integer;
begin
  select c into other_c from sms_fixtures where n = 7;
  select * into f from sms_fixtures where n = 1;
  perform pg_temp.expect_sms_failure(format(
    'select public.record_signed_agreement_visit_sms_consent(%L,%L,%L)', f.a, other_c, f.phone),
    'conversation does not belong');
  perform pg_temp.expect_sms_failure(format(
    'select public.record_signed_agreement_visit_sms_consent(%L,%L,%L)', f.a, f.c, '+12025550198'),
    'original affirmative text consent');
  perform public.record_signed_agreement_visit_sms_consent(f.a, f.c, f.phone);
  perform public.record_signed_agreement_visit_sms_consent(f.a, f.c, f.phone);
  select count(*) into count_events from public.customer_contact_consent_events
    where idempotency_key = 'signed-agreement:' || f.a || ':visit-sms-v1';
  if count_events <> 1 then raise exception 'Retry was not idempotent'; end if;
  if not exists (select 1 from public.customer_contact_consent_events e
    where e.homeowner_id = f.h and e.address_normalized = f.phone
      and e.request_ip = '192.0.2.10' and e.user_agent = 'SyntheticOriginalSigner/1.0'
      and e.disclosure_version = 'sign-together-visit-reminders-v1'
      and e.source_path = '/api/sign-agreement' and e.next_status = 'opted_in') then
    raise exception 'Original signature evidence was not recorded';
  end if;
  if not exists (select 1 from public.homeowners where id = f.h and phone = f.phone) then
    raise exception 'Missing phone was not filled';
  end if;
  -- A later STOP remains authoritative even on retry of a successful signature.
  update public.customer_contact_points set consent_status = 'opted_out',
    consent_recorded_at = now(), opt_out_reason = 'STOP' where homeowner_id = f.h;
  perform public.record_signed_agreement_visit_sms_consent(f.a, f.c, f.phone);
  if not exists (select 1 from public.customer_contact_points where homeowner_id = f.h
    and consent_status = 'opted_out' and opt_out_reason = 'STOP') then
    raise exception 'Retry erased later STOP';
  end if;
  for f in select * from sms_fixtures where n > 1 loop
    perform pg_temp.expect_sms_failure(format(
      'select public.record_signed_agreement_visit_sms_consent(%L,%L,%L)', f.a, f.c, f.phone),
      case f.n when 3 then 'previously opted-out' when 4 then 'belongs to another customer'
      when 5 then 'different phone number' else 'original affirmative text consent' end);
    if exists (select 1 from public.customer_contact_consent_events where homeowner_id = f.h) then
      raise exception 'Rejected attempt left consent evidence';
    end if;
  end loop;
  select * into f from sms_fixtures where n = 2;
  perform pg_temp.expect_sms_failure(format(
    'update public.signed_agreements set visit_sms_opt_in=true, visit_sms_phone=%L, visit_sms_disclosure_version=%L where id=%L',
    f.phone, 'sign-together-visit-reminders-v1', f.a), 'Original signing consent evidence cannot be changed');
  select * into f from sms_fixtures where n = 1;
  perform pg_temp.expect_sms_failure(format(
    'update public.signed_agreements set visit_sms_phone=%L where id=%L',
    '+12025550198', f.a), 'Original signing consent evidence cannot be changed');
  perform pg_temp.expect_sms_failure(format(
    'update public.signed_agreements set visit_sms_disclosure_version=%L where id=%L',
    'invented-version', f.a), 'Original signing consent evidence cannot be changed');
  perform pg_temp.expect_sms_failure(format(
    'update public.signed_agreements set visit_sms_opt_in=false,visit_sms_phone=null,visit_sms_disclosure_version=null where id=%L',
    f.a), 'Original signing consent evidence cannot be changed');
  if not exists (select 1 from public.customer_contact_points p join sms_fixtures s
    on s.h=p.homeowner_id where s.n=3 and p.consent_status='opted_out' and p.opt_out_reason='STOP') then
    raise exception 'Existing STOP was altered';
  end if;
end;
$$;

-- Check both ACL and actual execution as ordinary roles (the function body must not run).
do $$
declare role_name text; denied boolean;
begin
  if not has_function_privilege('service_role',
    'public.record_signed_agreement_visit_sms_consent(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Service role cannot execute recorder';
  end if;
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_function_privilege(role_name,
      'public.record_signed_agreement_visit_sms_consent(uuid,uuid,text)', 'EXECUTE') then
      raise exception 'Ordinary role unexpectedly has recorder permission: %', role_name;
    end if;
    denied := false;
    execute format('set local role %I', role_name);
    begin
      perform public.record_signed_agreement_visit_sms_consent(null, null, '+12025550100');
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if not denied then raise exception 'Ordinary role executed recorder: %', role_name; end if;
  end loop;
end;
$$;
select 'PASS: original evidence, STOP, ownership, retries, immutability, role restrictions' as result;
rollback;
