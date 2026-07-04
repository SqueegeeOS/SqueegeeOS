-- Atlas Pricing Engine — editable company settings (singleton)
create table if not exists pricing_settings (
  id text primary key default 'default',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table pricing_settings enable row level security;

drop policy if exists "pricing_settings_anon_all" on pricing_settings;
create policy "pricing_settings_anon_all" on pricing_settings
  for all using (true) with check (true);

insert into pricing_settings (id, settings)
values (
  'default',
  '{
    "minimumQuoteSqft": 500,
    "maximumQuoteSqft": 12000,
    "rates": {
      "quarterly": { "ratePerSqft": 0.1, "annualVisits": 4 },
      "bi_annual": { "ratePerSqft": 0.125, "annualVisits": 2 }
    },
    "interiorMultiplier": 1.6,
    "oneTimePremium": 150,
    "exteriorAddOns": {
      "softWash": {
        "defaultPrice": 250,
        "minPrice": 200,
        "maxPrice": 300,
        "largeHomeSqftThreshold": 5500,
        "largeHomePer1000Sqft": 40
      },
      "mossRemoval": { "ratePerSqft": 0.6 },
      "pressureWashConcrete": { "ratePerSqft": 0.3 },
      "memberAddOnDiscount": { "quarterly": 25, "bi_annual": 20 },
      "screenRescreening": {
        "singleScreenPrice": 40,
        "midTierMinCount": 3,
        "midTierMaxCount": 5,
        "midTierPricePerScreen": 30,
        "bulkMinCount": 6,
        "bulkPricePerScreen": 25
      }
    }
  }'::jsonb
)
on conflict (id) do nothing;
