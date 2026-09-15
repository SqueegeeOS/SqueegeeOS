begin;

create table if not exists public.enrollment_packet_access_tokens (
  id uuid primary key default gen_random_uuid(),
  enrollment_packet_id uuid not null
    references public.enrollment_packets(id) on delete cascade,
  token_sha256 text not null unique check (
    token_sha256 ~ '^[0-9a-f]{64}$'
  ),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.enrollment_packet_access_tokens enable row level security;

revoke all on table public.enrollment_packet_access_tokens from anon, authenticated;

create index if not exists enrollment_packet_access_tokens_packet_idx
  on public.enrollment_packet_access_tokens (enrollment_packet_id, expires_at desc);

create index if not exists enrollment_packet_access_tokens_active_idx
  on public.enrollment_packet_access_tokens (expires_at)
  where revoked_at is null;

comment on table public.enrollment_packet_access_tokens is
  'Private history of enrollment-link digests. Resending a packet adds a link instead of invalidating earlier unexpired customer emails.';

insert into public.enrollment_packet_access_tokens (
  enrollment_packet_id,
  token_sha256,
  expires_at
)
select
  id,
  public_token_sha256,
  public_token_expires_at
from public.enrollment_packets
on conflict (token_sha256) do nothing;

commit;
