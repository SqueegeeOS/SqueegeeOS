begin;

-- Separate immutable HQ evidence. Never rewrite technician notes, clocks or Jobber.
create table public.homeatlas_technician_issue_resolutions (
  field_record_id uuid primary key references public.homeatlas_technician_job_closeouts(field_record_id) on delete restrict,
  resolution_note text not null check (char_length(trim(resolution_note)) between 3 and 1200),
  resolved_by text not null check (char_length(trim(resolved_by)) between 1 and 100),
  resolved_at timestamptz not null default now()
);
alter table public.homeatlas_technician_issue_resolutions enable row level security;
revoke all on public.homeatlas_technician_issue_resolutions from public, anon, authenticated;
grant select, insert on public.homeatlas_technician_issue_resolutions to service_role;

create function public.reject_technician_issue_resolution_change()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  raise exception 'Technician issue resolutions are immutable';
end;
$$;
create trigger technician_issue_resolution_immutable before update or delete
on public.homeatlas_technician_issue_resolutions for each row
execute function public.reject_technician_issue_resolution_change();
revoke all on function public.reject_technician_issue_resolution_change() from public, anon, authenticated;

create function public.resolve_homeatlas_technician_issue(
  p_assignment_id uuid, p_field_record_id uuid, p_resolution_note text, p_resolved_by text
)
returns setof public.homeatlas_technician_issue_resolutions
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  closeout public.homeatlas_technician_job_closeouts%rowtype;
  existing public.homeatlas_technician_issue_resolutions%rowtype;
begin
  if p_assignment_id is null or p_field_record_id is null or
     coalesce(char_length(trim(p_resolution_note)), 0) not between 3 and 1200 or
     coalesce(char_length(trim(p_resolved_by)), 0) not between 1 and 100 then
    raise exception 'Invalid issue resolution' using errcode = '22023';
  end if;
  -- Serializes competing owner clicks and binds the action to the evidence viewed.
  perform 1 from public.homeatlas_technician_visit_assignments where id = p_assignment_id for update;
  select * into closeout from public.homeatlas_technician_job_closeouts c
    where c.assignment_id = p_assignment_id and c.field_record_id = p_field_record_id;
  if not found then raise exception 'Closeout not found' using errcode = 'P0002'; end if;
  if not closeout.follow_up_needed and nullif(trim(closeout.scope_exception), '') is null then
    raise exception 'This closeout has no issue to resolve' using errcode = '22023';
  end if;
  select * into existing from public.homeatlas_technician_issue_resolutions r where r.field_record_id = p_field_record_id;
  if found then
    if existing.resolution_note <> trim(p_resolution_note) then
      raise exception 'Issue already resolved; refresh to see the saved note' using errcode = '23505';
    end if;
    return next existing;
    return;
  end if;
  return query insert into public.homeatlas_technician_issue_resolutions(field_record_id, resolution_note, resolved_by)
    values(p_field_record_id, trim(p_resolution_note), trim(p_resolved_by)) returning *;
end;
$$;
revoke all on function public.resolve_homeatlas_technician_issue(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_homeatlas_technician_issue(uuid, uuid, text, text) to service_role;

-- Old visits must remain actionable after they fall off Today's schedule.
create function public.list_open_homeatlas_technician_issues()
returns table(assignment_id uuid, field_record_id uuid, client_name text, technician_name text,
  visit_date date, scope_exception text, created_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public as $$
  select c.assignment_id, c.field_record_id, p.client_name, c.technician_display_name,
    c.visit_date, c.scope_exception, c.created_at
  from public.homeatlas_technician_job_closeouts c
  join public.homeatlas_technician_visit_assignments a on a.id = c.assignment_id
  join public.jobber_visit_projections p on p.id = a.projection_id
  where (c.follow_up_needed or nullif(trim(c.scope_exception), '') is not null)
    and not exists (select 1 from public.homeatlas_technician_issue_resolutions r where r.field_record_id = c.field_record_id)
  order by c.created_at, c.field_record_id limit 51;
$$;
revoke all on function public.list_open_homeatlas_technician_issues() from public, anon, authenticated;
grant execute on function public.list_open_homeatlas_technician_issues() to service_role;
commit;
