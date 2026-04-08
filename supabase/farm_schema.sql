-- ============================================================
-- Harvest: Farm Management + AI Schema  (idempotent)
-- Run AFTER social_schema.sql (ai_requests references posts).
-- Run this entire file in the Supabase SQL editor.
-- ============================================================


-- ─── 1. Storage bucket for farm & AI media ────────────────
-- Object paths must follow: "<user_id>/<filename>"

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'farm-media', 'farm-media', true,
  20971520,  -- 20 MB (larger for diagnostic images)
  array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif']
) on conflict (id) do nothing;

drop policy if exists "Users view own farm media"    on storage.objects;
drop policy if exists "Auth users upload farm media" on storage.objects;
drop policy if exists "Users delete own farm media"  on storage.objects;

create policy "Users view own farm media"
  on storage.objects for select
  using (bucket_id = 'farm-media'
    and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Auth users upload farm media"
  on storage.objects for insert
  with check (bucket_id = 'farm-media'
    and auth.uid() is not null
    and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own farm media"
  on storage.objects for delete
  using (bucket_id = 'farm-media'
    and auth.uid()::text = (storage.foldername(name))[1]);


-- ─── 2. Farm records ───────────────────────────────────────
-- One row per crop planting / livestock group / equipment item.

create table if not exists public.farm_records (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        references public.profiles(id) on delete cascade not null,

  -- Identity
  name                 text        not null,
  description          text,
  record_type          text        not null default 'crop'
                         check (record_type in ('crop','livestock','poultry','aquaculture','beekeeping','equipment','other')),

  -- Crop / planting details
  crop_type            text,
  area_planted         numeric,          -- in user's preferred unit (acres or ha)
  area_unit            text        default 'acres',
  growth_stage         text
                         check (growth_stage in (
                           'germination','seedling','vegetative','flowering',
                           'fruiting','harvest','post-harvest', null)),
  sowing_date          date,
  expected_harvest_date date,
  actual_harvest_date  date,
  expected_yield       numeric,
  actual_yield         numeric,
  yield_unit           text        default 'kg',

  -- Schedules (stored as JSON arrays of {date, notes} objects)
  irrigation_schedule  jsonb       default '[]',
  fertilizer_schedule  jsonb       default '[]',
  pesticide_schedule   jsonb       default '[]',

  -- Health & AI
  health_status        text        not null default 'healthy'
                         check (health_status in ('healthy','at_risk','affected')),
  pest_disease_flags   text[]      default '{}',
  ai_diagnosis_status  text        not null default 'none'
                         check (ai_diagnosis_status in ('none','pending','processing','done','failed')),

  -- Media
  media_urls           text[]      default '{}',

  -- Labour & equipment
  assigned_workers     text[]      default '{}',
  equipment_used       text[]      default '{}',

  -- Status
  status               text        not null default 'active'
                         check (status in ('active','completed','archived')),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.farm_records enable row level security;

drop policy if exists "Users read own farm records"   on public.farm_records;
drop policy if exists "Users create farm records"     on public.farm_records;
drop policy if exists "Users update own farm records" on public.farm_records;
drop policy if exists "Users delete own farm records" on public.farm_records;

create policy "Users read own farm records"
  on public.farm_records for select using (auth.uid() = user_id);
create policy "Users create farm records"
  on public.farm_records for insert with check (auth.uid() = user_id);
create policy "Users update own farm records"
  on public.farm_records for update using (auth.uid() = user_id);
create policy "Users delete own farm records"
  on public.farm_records for delete using (auth.uid() = user_id);

create index if not exists idx_farm_records_user_id
  on public.farm_records (user_id);
create index if not exists idx_farm_records_crop_type
  on public.farm_records (crop_type);
create index if not exists idx_farm_records_status
  on public.farm_records (status);
create index if not exists idx_farm_records_sowing_date
  on public.farm_records (sowing_date);
create index if not exists idx_farm_records_harvest_date
  on public.farm_records (expected_harvest_date);


-- ─── 3. Farm activities ────────────────────────────────────
-- Discrete farm actions (planting, irrigation, harvesting…).

create table if not exists public.farm_activities (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references public.profiles(id) on delete cascade not null,
  farm_record_id   uuid        references public.farm_records(id) on delete set null,

  activity_type    text        not null
                     check (activity_type in (
                       'planting','irrigation','fertilization','pesticide',
                       'harvesting','equipment_maintenance','labor',
                       'soil_testing','observation','other')),
  title            text        not null,
  notes            text,

  -- Timing
  start_time       timestamptz not null,
  end_time         timestamptz,
  is_completed     boolean     not null default false,

  -- Recurrence
  is_recurring     boolean     not null default false,
  recurrence_rule  text,       -- 'daily' | 'weekly' | 'monthly' | cron string

  -- Alarm / reminder
  alarm_at         timestamptz,
  alarm_sent       boolean     not null default false,

  -- Resources
  assigned_workers text[]      default '{}',
  equipment_used   text[]      default '{}',
  inputs_used      text,       -- e.g. "50 kg NPK 17-17-17"
  estimated_cost   numeric,
  actual_cost      numeric,
  cost_currency    text        default 'KES',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.farm_activities enable row level security;

drop policy if exists "Users read own activities"   on public.farm_activities;
drop policy if exists "Users create activities"     on public.farm_activities;
drop policy if exists "Users update own activities" on public.farm_activities;
drop policy if exists "Users delete own activities" on public.farm_activities;

create policy "Users read own activities"
  on public.farm_activities for select using (auth.uid() = user_id);
create policy "Users create activities"
  on public.farm_activities for insert with check (auth.uid() = user_id);
create policy "Users update own activities"
  on public.farm_activities for update using (auth.uid() = user_id);
create policy "Users delete own activities"
  on public.farm_activities for delete using (auth.uid() = user_id);

create index if not exists idx_farm_activities_user_id
  on public.farm_activities (user_id);
create index if not exists idx_farm_activities_record_id
  on public.farm_activities (farm_record_id);
create index if not exists idx_farm_activities_type
  on public.farm_activities (activity_type);
create index if not exists idx_farm_activities_start_time
  on public.farm_activities (start_time);
create index if not exists idx_farm_activities_alarm_at
  on public.farm_activities (alarm_at)
  where alarm_at is not null and alarm_sent = false;


-- ─── 4. Farm notifications ─────────────────────────────────

create table if not exists public.farm_notifications (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references public.profiles(id) on delete cascade not null,

  notification_type   text        not null
                        check (notification_type in (
                          'task_due','harvest_reminder','pest_alert',
                          'ai_result','weather','system')),
  title               text        not null,
  message             text        not null,
  action_url          text,       -- optional deep-link path

  related_record_id   uuid        references public.farm_records(id) on delete set null,
  related_activity_id uuid        references public.farm_activities(id) on delete set null,

  is_read             boolean     not null default false,
  created_at          timestamptz not null default now()
);

alter table public.farm_notifications enable row level security;

drop policy if exists "Users read own notifications"   on public.farm_notifications;
drop policy if exists "Users create own notifications" on public.farm_notifications;
drop policy if exists "Users update own notifications" on public.farm_notifications;
drop policy if exists "Users delete own notifications" on public.farm_notifications;

create policy "Users read own notifications"
  on public.farm_notifications for select using (auth.uid() = user_id);
create policy "Users create own notifications"
  on public.farm_notifications for insert with check (auth.uid() = user_id);
create policy "Users update own notifications"
  on public.farm_notifications for update using (auth.uid() = user_id);
create policy "Users delete own notifications"
  on public.farm_notifications for delete using (auth.uid() = user_id);

create index if not exists idx_farm_notifications_user_id
  on public.farm_notifications (user_id);
create index if not exists idx_farm_notifications_is_read
  on public.farm_notifications (user_id, is_read)
  where is_read = false;
create index if not exists idx_farm_notifications_created_at
  on public.farm_notifications (created_at desc);


-- ─── 5. AI requests (chatbot + image diagnosis) ────────────
-- Each row is one user turn. session_id groups a conversation.

create table if not exists public.ai_requests (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        references public.profiles(id) on delete cascade not null,

  -- Conversation grouping (all turns in one chat share a session_id)
  session_id            uuid        not null default gen_random_uuid(),

  request_type          text        not null
                          check (request_type in ('chatbot','image_diagnosis')),
  mode                  text,       -- 'advice' | 'diagnosis' | 'planning' (from FarmAssistant modes)

  -- Input
  text_query            text,
  image_url             text,       -- farm-media bucket URL for uploaded image

  -- Links (optional cross-references)
  related_farm_record_id uuid       references public.farm_records(id) on delete set null,
  related_post_id        uuid       references public.posts(id) on delete set null,

  -- AI output
  status                text        not null default 'pending'
                          check (status in ('pending','processing','done','failed')),
  response_text         text,       -- AI-generated response / diagnosis
  ai_model              text,       -- which model responded
  confidence_score      numeric,    -- 0-1 where applicable (image diagnosis)
  tags                  text[]      default '{}',  -- extracted tags/conditions

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.ai_requests enable row level security;

drop policy if exists "Users read own ai requests"   on public.ai_requests;
drop policy if exists "Users create ai requests"     on public.ai_requests;
drop policy if exists "Users update own ai requests" on public.ai_requests;
drop policy if exists "Users delete own ai requests" on public.ai_requests;

create policy "Users read own ai requests"
  on public.ai_requests for select using (auth.uid() = user_id);
create policy "Users create ai requests"
  on public.ai_requests for insert with check (auth.uid() = user_id);
create policy "Users update own ai requests"
  on public.ai_requests for update using (auth.uid() = user_id);
create policy "Users delete own ai requests"
  on public.ai_requests for delete using (auth.uid() = user_id);

create index if not exists idx_ai_requests_user_id
  on public.ai_requests (user_id);
create index if not exists idx_ai_requests_session_id
  on public.ai_requests (session_id);
create index if not exists idx_ai_requests_type
  on public.ai_requests (request_type);
create index if not exists idx_ai_requests_status
  on public.ai_requests (status)
  where status in ('pending','processing');
create index if not exists idx_ai_requests_farm_record
  on public.ai_requests (related_farm_record_id)
  where related_farm_record_id is not null;
create index if not exists idx_ai_requests_created_at
  on public.ai_requests (user_id, created_at desc);


-- ─── 6. updated_at trigger function ───────────────────────
-- Shared function; triggers below call it for each table.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- farm_records
drop trigger if exists trg_farm_records_updated_at on public.farm_records;
create trigger trg_farm_records_updated_at
  before update on public.farm_records
  for each row execute function public.set_updated_at();

-- farm_activities
drop trigger if exists trg_farm_activities_updated_at on public.farm_activities;
create trigger trg_farm_activities_updated_at
  before update on public.farm_activities
  for each row execute function public.set_updated_at();

-- ai_requests
drop trigger if exists trg_ai_requests_updated_at on public.ai_requests;
create trigger trg_ai_requests_updated_at
  before update on public.ai_requests
  for each row execute function public.set_updated_at();


-- ─── 7. Auto-notify on harvest approach ───────────────────
-- Inserts a farm_notification 7 days before expected harvest.
-- Designed to be called by a scheduled Supabase Edge Function
-- (pg_cron job) rather than a row-level trigger, but the
-- query pattern is provided here for reference.
--
-- Example pg_cron job (run daily at 07:00 EAT = 04:00 UTC):
--
--   select cron.schedule(
--     'harvest-reminders',
--     '0 4 * * *',
--     $$
--       insert into public.farm_notifications
--         (user_id, notification_type, title, message, related_record_id)
--       select
--         fr.user_id,
--         'harvest_reminder',
--         'Harvest approaching: ' || fr.name,
--         fr.name || ' is expected to be ready for harvest in 7 days.',
--         fr.id
--       from public.farm_records fr
--       where fr.status = 'active'
--         and fr.expected_harvest_date = current_date + interval '7 days'
--         and not exists (
--           select 1 from public.farm_notifications fn
--           where fn.related_record_id = fr.id
--             and fn.notification_type = 'harvest_reminder'
--             and fn.created_at > now() - interval '2 days'
--         );
--     $$
--   );
