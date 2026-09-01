-- Existing Supabase projects can grant service_role DML through default
-- privileges. The job clock deliberately routes all writes through its single
-- validation RPC, so remove direct writes after the initial migration too.

begin;

revoke insert, update, delete on table public.technician_job_time_entries
  from service_role;
grant select on table public.technician_job_time_entries to service_role;

commit;
