-- Bind each seeded attorney-review version to the exact internal review copy
-- that HomeAtlas displays and prints. This is change-control evidence only:
-- it does not approve a document, populate the released-document hash, send a
-- DocuSign envelope, or authorize any customer communication or charge.

begin;

alter table public.agreement_document_versions
  add column if not exists review_copy_sha256 text;

alter table public.agreement_document_versions
  drop constraint if exists agreement_document_versions_review_copy_sha256_check;
alter table public.agreement_document_versions
  add constraint agreement_document_versions_review_copy_sha256_check check (
    review_copy_sha256 is null
    or review_copy_sha256 ~ '^[0-9a-f]{64}$'
  );

update public.agreement_document_versions
set review_copy_sha256 = case
  when document_kind = 'master_service_agreement'
    and version = 'ca-msa-v1-draft'
    then '2319bee07339c2a2b834847550329ed5f79980c594785b6c0f75c01152430d1d'
  when document_kind = 'service_quote_agreement'
    and version = 'ca-service-quote-v1-draft'
    then 'bb473f0977b215b24bbb4fc2970fc2afc0ccf54b9f80a59cc568767751d5dba9'
  else review_copy_sha256
end
where status = 'attorney_review'
  and review_copy_sha256 is null
  and (
    (document_kind = 'master_service_agreement'
      and version = 'ca-msa-v1-draft')
    or
    (document_kind = 'service_quote_agreement'
      and version = 'ca-service-quote-v1-draft')
  );

comment on column public.agreement_document_versions.review_copy_sha256 is
  'SHA-256 fingerprint of the canonical internal counsel-review copy. Separate from content_sha256, which identifies the approved released document.';

commit;
