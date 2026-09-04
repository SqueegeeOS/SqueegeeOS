-- Private service-role-only grant table. Reserve before the provider call so a
-- timeout/repeated click never sends the same bearer invitation twice.
alter table public.technician_access_grants
  add column if not exists sms_attempted_at timestamptz,
  add column if not exists sms_provider_message_id text,
  add column if not exists sms_delivery_status text;
