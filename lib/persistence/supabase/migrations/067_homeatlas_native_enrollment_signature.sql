-- HomeAtlas native customer signing.
-- Existing packets remain bound to DocuSign; new packets explicitly choose a
-- provider. The customer-facing signature endpoint still uses the private
-- enrollment token and service-role writes, so no public table access opens.

alter table public.enrollment_packets
  add column if not exists signature_provider text;

update public.enrollment_packets
set signature_provider = 'docusign'
where signature_provider is null;

alter table public.enrollment_packets
  alter column signature_provider set default 'homeatlas_native',
  alter column signature_provider set not null;

alter table public.enrollment_packets
  drop constraint if exists enrollment_packets_signature_provider_check;

alter table public.enrollment_packets
  add constraint enrollment_packets_signature_provider_check
  check (signature_provider in ('homeatlas_native', 'docusign'));

comment on column public.enrollment_packets.signature_provider is
  'Signing experience selected when the packet is prepared. homeatlas_native uses the private HomeAtlas signature box; docusign preserves legacy envelopes.';

comment on table public.enrollment_packets is
  'Private enrollment state machine linking an immutable agreement snapshot, selected signature evidence, payment handoff, and the final HomeAtlas portal.';
