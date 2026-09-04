-- Technician Access is an explicit, revocable company role. The install link
-- remains one-time and short-lived, while the device session lasts long enough
-- to avoid monthly re-enrollment. Every request still validates active status.

begin;

create table if not exists public.homeatlas_technicians (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  phone_e164 text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(display_name), '') is not null),
  check (length(display_name) <= 80),
  check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

drop trigger if exists homeatlas_technicians_updated_at
  on public.homeatlas_technicians;
create trigger homeatlas_technicians_updated_at
  before update on public.homeatlas_technicians
  for each row execute function public.set_updated_at();

alter table public.homeatlas_technicians enable row level security;
revoke all privileges on table public.homeatlas_technicians
  from public, anon, authenticated;
grant select, insert, update, delete on table public.homeatlas_technicians
  to service_role;

insert into public.homeatlas_technicians (display_name, phone_e164, status)
values ('Tyler Germany', '+16192732188', 'active')
on conflict (phone_e164) do update
set display_name = excluded.display_name,
    status = 'active';

alter table public.technician_access_grants
  add column if not exists access_role text not null default 'technician';

alter table public.technician_access_grants
  drop constraint if exists technician_access_grants_access_role_check;

alter table public.technician_access_grants
  add constraint technician_access_grants_access_role_check
  check (access_role = 'technician');

create or replace function public.claim_technician_access_grant(
  p_invite_token_hash text,
  p_session_token_hash text,
  p_session_expires_at timestamptz
)
returns table(
  grant_id uuid,
  jobber_user_id text,
  display_name text,
  session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_grant_id uuid;
  claimed_jobber_user_id text;
  claimed_display_name text;
  claimed_session_expires_at timestamptz;
begin
  if p_invite_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_token_hash !~ '^[0-9a-f]{64}$'
     or p_session_expires_at <= now()
     or p_session_expires_at > now() + interval '401 days' then
    raise exception 'Invalid technician access claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_invite_token_hash, 0));

  update public.technician_access_grants grant_row
  set status = 'active',
      access_role = 'technician',
      session_token_hash = p_session_token_hash,
      session_expires_at = p_session_expires_at,
      claimed_at = now()
  where grant_row.invite_token_hash = p_invite_token_hash
    and grant_row.status = 'pending'
    and grant_row.claimed_at is null
    and grant_row.invite_expires_at > now()
  returning grant_row.id,
    grant_row.jobber_user_id,
    grant_row.display_name,
    grant_row.session_expires_at
  into claimed_grant_id,
    claimed_jobber_user_id,
    claimed_display_name,
    claimed_session_expires_at;

  if claimed_grant_id is null then
    raise exception 'Technician Access invite is invalid or expired';
  end if;

  return query select
    claimed_grant_id,
    claimed_jobber_user_id,
    claimed_display_name,
    claimed_session_expires_at;
end;
$$;

revoke all on function public.claim_technician_access_grant(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_technician_access_grant(
  text, text, timestamptz
) to service_role;

comment on column public.technician_access_grants.access_role is
  'Server-validated HomeAtlas role. Technician access remains active until revoked or the long-lived device credential reaches its safety horizon.';

alter table public.lead_intakes
  add column if not exists referred_by_technician_key text,
  add column if not exists referred_by_technician_name text,
  add column if not exists referral_permission_confirmed_at timestamptz;

alter table public.lead_intakes
  drop constraint if exists lead_intakes_source_check,
  add constraint lead_intakes_source_check check (
    source in ('request_form', 'facebook_lead_ad', 'technician_referral')
  ),
  drop constraint if exists lead_intakes_external_identity_check,
  add constraint lead_intakes_external_identity_check check (
    (source in ('request_form', 'technician_referral') and external_lead_id is null)
    or
    (source = 'facebook_lead_ad' and external_lead_id is not null)
  ),
  drop constraint if exists lead_intakes_technician_referral_check,
  add constraint lead_intakes_technician_referral_check check (
    (
      source = 'technician_referral'
      and nullif(trim(coalesce(referred_by_technician_key, '')), '') is not null
      and nullif(trim(coalesce(referred_by_technician_name, '')), '') is not null
      and referral_permission_confirmed_at is not null
    )
    or
    (
      source <> 'technician_referral'
      and referred_by_technician_key is null
      and referred_by_technician_name is null
      and referral_permission_confirmed_at is null
    )
  );

alter table public.lead_intakes
  drop constraint if exists lead_intakes_client_submission_source_check,
  add constraint lead_intakes_client_submission_source_check check (
    source in ('request_form', 'technician_referral')
    or client_submission_id is null
  );

create index if not exists lead_intakes_technician_referral_idx
  on public.lead_intakes(referred_by_technician_key, submitted_at desc)
  where source = 'technician_referral';

create unique index if not exists lead_intakes_technician_submission_uidx
  on public.lead_intakes(client_submission_id)
  where source = 'technician_referral' and client_submission_id is not null;

alter table public.sales_rep_leads
  drop constraint if exists sales_rep_leads_source_check;
alter table public.sales_rep_leads
  add constraint sales_rep_leads_source_check
  check (source in (
    'door_to_door', 'referral', 'event', 'manual',
    'request_form', 'facebook_lead_ad', 'technician_referral'
  ));

alter table public.sales_rep_leads
  drop constraint if exists sales_rep_leads_intake_assignment_check;
alter table public.sales_rep_leads
  add constraint sales_rep_leads_intake_assignment_check
  check (
    lead_intake_id is null
    or (
      source in ('request_form', 'facebook_lead_ad', 'technician_referral')
      and next_follow_up_at is not null
    )
  );

comment on table public.homeatlas_technicians is
  'Private HomeAtlas technician roster independent of paid Jobber seats.';
comment on column public.lead_intakes.referred_by_technician_key is
  'Server-stamped technician identity; never accepted from the field client.';
comment on column public.lead_intakes.referral_permission_confirmed_at is
  'Technician attestation that the person asked SqueegeeKing to contact them; this is not SMS marketing consent.';

commit;
