-- Canyon Oaks demo seed — Phase 1A
-- Run in Supabase SQL editor after schema.sql + 005_member_intelligence.sql
-- Idempotent: safe to re-run (upserts by slug / fixed UUIDs)

-- ─────────────────────────────────────────────
-- 1. HOMEOWNER
-- ─────────────────────────────────────────────
INSERT INTO homeowners (
  id,
  slug,
  full_name,
  first_name,
  email,
  phone
) VALUES (
  'a1b2c3d4-0001-0001-0001-000000000001',
  'larry-buckley',
  'Larry Buckley',
  'Larry',
  'larry@canyonoaks.com',
  '(555) 847-2291'
)
ON CONFLICT (slug) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  first_name = EXCLUDED.first_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  updated_at = now();

-- ─────────────────────────────────────────────
-- 2. PROPERTY
-- ─────────────────────────────────────────────
INSERT INTO properties (
  id,
  homeowner_id,
  slug,
  name,
  address,
  city,
  state,
  zip,
  type,
  year_built,
  square_feet,
  zillow_url,
  property_details,
  access_instructions,
  last_visit
) VALUES (
  'b2c3d4e5-0002-0002-0002-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'canyon-oaks-residence',
  'Canyon Oaks Residence',
  '4125 Canyon Oaks Drive',
  'Chico',
  'California',
  '95928',
  'Canyon Estate',
  2004,
  2500,
  'https://www.zillow.com/homes/4125-Canyon-Oaks-Dr-Chico-CA/',
  '{
    "exteriorMaterial": "brick",
    "stories": 2,
    "garage": "2-car attached",
    "hasPool": false,
    "driveway": "concrete",
    "gutters": "6-inch K-style",
    "roofType": "composition shingle",
    "fence": "cedar privacy",
    "bedrooms": 4,
    "bathrooms": 3
  }'::jsonb,
  'Gate code: 4821. Dog in backyard — friendly. Key under mat for interior access.',
  'February 14, 2026'
)
ON CONFLICT (homeowner_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  square_feet = EXCLUDED.square_feet,
  zillow_url = EXCLUDED.zillow_url,
  property_details = EXCLUDED.property_details,
  access_instructions = EXCLUDED.access_instructions,
  last_visit = EXCLUDED.last_visit,
  updated_at = now();

-- ─────────────────────────────────────────────
-- 3. MEMBERSHIP (billing record)
-- ─────────────────────────────────────────────
INSERT INTO memberships (
  id,
  homeowner_id,
  property_id,
  plan_id,
  plan_name,
  price_display,
  billing_period,
  status,
  started_at
) VALUES (
  'd4e5f6a7-0004-0004-0004-000000000004',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'b2c3d4e5-0002-0002-0002-000000000002',
  'preferred',
  'Preferred Care',
  '$249',
  'per month',
  'active',
  '2024-03-15T00:00:00Z'
)
ON CONFLICT (property_id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  plan_name = EXCLUDED.plan_name,
  price_display = EXCLUDED.price_display,
  billing_period = EXCLUDED.billing_period,
  status = EXCLUDED.status,
  started_at = EXCLUDED.started_at,
  updated_at = now();

-- ─────────────────────────────────────────────
-- 4. MEMBER PROFILE
-- ─────────────────────────────────────────────
INSERT INTO member_profiles (
  id,
  homeowner_id,
  membership_tier,
  total_saved_cents,
  preferred_services,
  preferences
) VALUES (
  'c3d4e5f6-0003-0003-0003-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'premium',
  47000,
  '["exterior_windows", "pressure_wash", "gutter_clean"]'::jsonb,
  '{"dedicated_tech": "Marcus Webb"}'::jsonb
)
ON CONFLICT (homeowner_id) DO UPDATE SET
  membership_tier = EXCLUDED.membership_tier,
  total_saved_cents = EXCLUDED.total_saved_cents,
  preferred_services = EXCLUDED.preferred_services,
  preferences = EXCLUDED.preferences,
  updated_at = now();

-- ─────────────────────────────────────────────
-- 5. APPOINTMENTS — clear + re-seed demo schedule
-- ─────────────────────────────────────────────
DELETE FROM member_savings_transactions
WHERE member_profile_id = 'c3d4e5f6-0003-0003-0003-000000000003';

DELETE FROM service_observations
WHERE property_id = 'b2c3d4e5-0002-0002-0002-000000000002';

DELETE FROM member_appointments
WHERE member_profile_id = 'c3d4e5f6-0003-0003-0003-000000000003';

INSERT INTO member_appointments (
  id,
  member_profile_id,
  property_id,
  service_type,
  scheduled_at,
  status,
  technician_name,
  notes,
  completed_at
) VALUES
  (
    'e5f6a7b8-0005-0005-0005-000000000005',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'exterior_windows',
    '2026-01-22T09:00:00Z',
    'completed',
    'Marcus Webb',
    'All 18 exterior panes cleaned. Noted mineral buildup on master bath window — treated.',
    '2026-01-22T10:30:00Z'
  ),
  (
    'f6a7b8c9-0006-0006-0006-000000000006',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'pressure_wash',
    '2026-02-14T09:00:00Z',
    'completed',
    'Marcus Webb',
    'Full exterior wash. Driveway, walkway, back patio. Mildew on north-facing wall — cleared.',
    '2026-02-14T11:00:00Z'
  ),
  (
    'a7b8c9d0-0007-0007-0007-000000000007',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'gutter_clean',
    '2026-05-08T09:00:00Z',
    'completed',
    'Marcus Webb',
    'Full gutter flush and downspout check.',
    '2026-05-08T10:00:00Z'
  ),
  (
    'b8c9d0e1-0008-0008-0008-000000000008',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'exterior_windows',
    '2026-07-16T09:00:00Z',
    'scheduled',
    'Marcus Webb',
    null,
    null
  ),
  (
    'c9d0e1f2-0009-0009-0009-000000000009',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'concrete_clean',
    '2026-08-12T09:00:00Z',
    'scheduled',
    'Marcus Webb',
    null,
    null
  ),
  (
    'd0e1f2a3-0010-0010-0010-000000000010',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'exterior_windows',
    '2026-10-15T09:00:00Z',
    'scheduled',
    null,
    null,
    null
  ),
  (
    'e1f2a3b4-0011-0011-0011-000000000011',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'pressure_wash',
    '2026-11-12T09:00:00Z',
    'scheduled',
    null,
    null,
    null
  );

-- ─────────────────────────────────────────────
-- 6. SAVINGS TRANSACTIONS (YTD $470)
-- ─────────────────────────────────────────────
INSERT INTO member_savings_transactions (
  member_profile_id,
  property_id,
  service_type,
  regular_price_cents,
  member_price_cents,
  saved_cents,
  occurred_at,
  notes
) VALUES
  (
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'exterior_windows',
    12000,
    0,
    12000,
    '2026-01-22T10:30:00Z',
    'Covered by membership'
  ),
  (
    'c3d4e5f6-0003-0003-0003-000000000003',
    'b2c3d4e5-0002-0002-0002-000000000002',
    'pressure_wash',
    35000,
    0,
    35000,
    '2026-02-14T11:00:00Z',
    'Covered by membership'
  );

-- ─────────────────────────────────────────────
-- 7. SERVICE OBSERVATIONS
-- ─────────────────────────────────────────────
INSERT INTO service_observations (
  property_id,
  member_profile_id,
  appointment_id,
  observed_by,
  notes,
  observation_flags,
  observed_at
) VALUES
  (
    'b2c3d4e5-0002-0002-0002-000000000002',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'e5f6a7b8-0005-0005-0005-000000000005',
    'Marcus Webb',
    'Mineral buildup on master bath exterior window. Treated this visit. Monitor next quarter.',
    '[{"category": "windows", "severity": "low"}]'::jsonb,
    '2026-01-22T10:30:00Z'
  ),
  (
    'b2c3d4e5-0002-0002-0002-000000000002',
    'c3d4e5f6-0003-0003-0003-000000000003',
    'f6a7b8c9-0006-0006-0006-000000000006',
    'Marcus Webb',
    'Mildew forming on north-facing brick wall. Cleared with pressure wash. May recur — recommend annual treatment.',
    '[{"category": "exterior", "severity": "medium"}]'::jsonb,
    '2026-02-14T11:00:00Z'
  );
