-- Harvest — Farm Intelligence Engine migration (additive only)
-- Run in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Creates two new tables: weather_cache and farm_intelligence_alerts.
-- Does NOT touch any existing table, column, RLS policy, or auth setup.

-- ─── weather_cache ───────────────────────────────────────────────────────────
-- Server-side cache for Open-Meteo / wttr.in weather snapshots.
-- One row per (rounded lat,lon) so multiple users in the same area share data.
create table if not exists public.weather_cache (
  location_key  text         primary key,         -- e.g. "kiambu|kenya" or "lat:-1.29,lon:36.82"
  city          text,
  country       text,
  lat           double precision,
  lon           double precision,
  data          jsonb        not null,            -- full WeatherContext payload
  fetched_at    timestamptz  not null default now()
);
create index if not exists weather_cache_fetched_at_idx
  on public.weather_cache (fetched_at desc);

alter table public.weather_cache enable row level security;

-- Public read (weather is non-sensitive); writes only via service role.
drop policy if exists "weather_cache_public_read" on public.weather_cache;
create policy "weather_cache_public_read"
  on public.weather_cache for select using (true);

-- ─── farm_intelligence_alerts ────────────────────────────────────────────────
-- Persistent log of every Farm Intelligence run + every alert it produced.
create table if not exists public.farm_intelligence_alerts (
  id           uuid         default gen_random_uuid() primary key,
  user_id      uuid         not null references auth.users(id) on delete cascade,
  location     text,                                 -- "<region>|<country>" or coords
  alert_type   text         not null default 'general', -- weather | pest | disease | market | general
  severity     text         not null default 'medium',  -- low | medium | high
  message      text         not null,
  source       text         not null default 'ai',      -- weather | news | ai | farm
  payload      jsonb,                                   -- full intelligence snapshot
  is_dismissed boolean      not null default false,
  created_at   timestamptz  not null default now()
);

create index if not exists farm_intel_alerts_user_recent_idx
  on public.farm_intelligence_alerts (user_id, created_at desc);
create index if not exists farm_intel_alerts_severity_idx
  on public.farm_intelligence_alerts (user_id, severity);

alter table public.farm_intelligence_alerts enable row level security;

drop policy if exists "farm_intel_alerts_own_select" on public.farm_intelligence_alerts;
create policy "farm_intel_alerts_own_select"
  on public.farm_intelligence_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "farm_intel_alerts_own_update" on public.farm_intelligence_alerts;
create policy "farm_intel_alerts_own_update"
  on public.farm_intelligence_alerts for update
  using (auth.uid() = user_id);

drop policy if exists "farm_intel_alerts_own_delete" on public.farm_intelligence_alerts;
create policy "farm_intel_alerts_own_delete"
  on public.farm_intelligence_alerts for delete
  using (auth.uid() = user_id);

-- Inserts come from the Edge Function (service-role) — no insert policy needed
-- for end-users. If you ever want client-side inserts, add one explicitly.
