-- Let the business owner release the exact customer-facing DocuSign files
-- without falsely recording an outside-counsel approval. The provider files
-- are downloaded and SHA-256 verified by HomeAtlas before this service-role
-- function can bind them. Counsel review remains separately auditable later.

begin;

alter table public.agreement_document_versions
  add column if not exists release_authority text;

alter table public.agreement_document_versions
  drop constraint if exists agreement_document_versions_release_authority_check;
alter table public.agreement_document_versions
  add constraint agreement_document_versions_release_authority_check check (
    release_authority is null
    or release_authority in ('owner', 'counsel', 'legacy')
  );

alter table public.agreement_document_versions
  add column if not exists counsel_review_status text not null default 'pending';

alter table public.agreement_document_versions
  drop constraint if exists agreement_document_versions_counsel_review_status_check;
alter table public.agreement_document_versions
  add constraint agreement_document_versions_counsel_review_status_check check (
    counsel_review_status in ('pending', 'reviewed', 'revisions_requested')
  );

alter table public.agreement_document_versions
  add column if not exists counsel_reviewed_at timestamptz,
  add column if not exists counsel_reviewed_by text;

create or replace function public.release_enrollment_agreement_pair(
  p_msa_version text,
  p_msa_content_sha256 text,
  p_service_version text,
  p_service_content_sha256 text,
  p_actor text
)
returns setof public.agreement_document_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msa_id uuid;
  v_service_id uuid;
  v_released_at timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if nullif(trim(coalesce(p_actor, '')), '') is null then
    raise exception 'release actor required';
  end if;
  if coalesce(p_msa_content_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_service_content_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid released document fingerprint';
  end if;

  select id into v_msa_id
  from public.agreement_document_versions
  where document_kind = 'master_service_agreement'
    and version = p_msa_version
    and review_copy_sha256 is not null
  for update;
  if v_msa_id is null then
    raise exception 'MSA review version is not releaseable';
  end if;

  select id into v_service_id
  from public.agreement_document_versions
  where document_kind = 'service_quote_agreement'
    and version = p_service_version
    and review_copy_sha256 is not null
  for update;
  if v_service_id is null then
    raise exception 'Service and Quote review version is not releaseable';
  end if;

  update public.agreement_document_versions
  set status = 'retired'
  where status = 'approved'
    and document_kind in (
      'master_service_agreement',
      'service_quote_agreement'
    );

  update public.agreement_document_versions
  set status = 'approved',
      content_sha256 = p_msa_content_sha256,
      approved_at = v_released_at,
      approved_by = trim(p_actor),
      release_authority = 'owner',
      counsel_review_status = 'pending'
  where id = v_msa_id;

  update public.agreement_document_versions
  set status = 'approved',
      content_sha256 = p_service_content_sha256,
      approved_at = v_released_at,
      approved_by = trim(p_actor),
      release_authority = 'owner',
      counsel_review_status = 'pending'
  where id = v_service_id;

  return query
  select version.*
  from public.agreement_document_versions version
  where version.id in (v_msa_id, v_service_id)
  order by version.document_kind;
end;
$$;

revoke all on function public.release_enrollment_agreement_pair(
  text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.release_enrollment_agreement_pair(
  text, text, text, text, text
) to service_role;

comment on column public.agreement_document_versions.release_authority is
  'Who released the exact customer-facing bytes: owner, counsel, or a legacy process.';
comment on column public.agreement_document_versions.counsel_review_status is
  'Separate later-counsel-review state; owner release does not imply legal approval.';
comment on function public.release_enrollment_agreement_pair(
  text, text, text, text, text
) is
  'Atomically releases the exact provider-file hashes for both enrollment agreements. Service role only; sends no envelope.';

commit;
