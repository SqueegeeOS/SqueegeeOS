-- Migration 049: audit-safe correction for accidental sales pulse taps.
-- Original activity rows remain immutable; an authorized server route may
-- populate only the reversal audit fields during a short undo window.

alter table public.sales_rep_activity_events
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by text,
  add column if not exists reversal_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_rep_activity_reversal_audit_check'
      and conrelid = 'public.sales_rep_activity_events'::regclass
  ) then
    alter table public.sales_rep_activity_events
      add constraint sales_rep_activity_reversal_audit_check
      check (
        (
          reversed_at is null
          and reversed_by is null
          and reversal_reason is null
        )
        or
        (
          reversed_at is not null
          and reversed_by is not null
          and char_length(btrim(reversed_by)) between 2 and 120
          and reversal_reason is not null
          and char_length(btrim(reversal_reason)) between 2 and 240
        )
      );
  end if;
end
$$;

alter table public.sales_rep_activity_events enable row level security;

revoke update, delete on table public.sales_rep_activity_events
  from public, anon, authenticated;
revoke delete on table public.sales_rep_activity_events
  from service_role;

-- Column-level UPDATE preserves the append-only event identity, ownership,
-- type, count, source, and timestamps while allowing an audited correction.
grant update (reversed_at, reversed_by, reversal_reason)
  on table public.sales_rep_activity_events
  to service_role;

comment on column public.sales_rep_activity_events.reversed_at is
  'When set, this event is omitted from live sales totals but retained for audit';
comment on column public.sales_rep_activity_events.reversed_by is
  'Server-authenticated actor class that requested the correction';
comment on column public.sales_rep_activity_events.reversal_reason is
  'Bounded machine-readable reason for retaining the reversed event';
comment on table public.sales_rep_activity_events is
  'Append-only field activity pulse; corrections retain the event and populate reversal audit fields';
