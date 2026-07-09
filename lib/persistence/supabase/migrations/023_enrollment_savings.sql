-- Migration 023: Membership enrollment savings (per-visit savings locked at activation)
-- Run after 022_website_membership_sales.sql
-- Safe to re-run: uses IF NOT EXISTS.

alter table presentations
  add column if not exists enrollment_savings numeric(10, 2);

comment on column presentations.enrollment_savings is
  'Per-visit savings vs one-time at enrollment — editable before signing; copied to membership at activation';

alter table memberships
  add column if not exists membership_enrollment_savings numeric(10, 2);

comment on column memberships.membership_enrollment_savings is
  'Immutable per-visit enrollment savings locked when membership activates — source of truth for reimbursement and portal';
