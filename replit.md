# Harvest - Agricultural Platform

## Overview
Harvest is a mobile-first React PWA for agricultural communities. It connects farmers, provides farm management tools, a marketplace, community features, and an AI farm assistant.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI)
- **Routing**: React Router v6
- **State/Data**: TanStack React Query (with optimistic updates)
- **Auth/DB**: Supabase (PostgreSQL + Auth + Google OAuth)
- **Forms**: React Hook Form + Zod
- **PWA**: manifest.json (installable, mobile-first)

## Project Structure
```
src/
  App.tsx                  # Root component, routes
  main.tsx                 # Entry point
  pages/
    Index.tsx              # Home page
    Community.tsx          # Feed + Communities (full community system)
    Marketplace.tsx        # Marketplace listings
    FarmManagement.tsx     # My Farm (farm activities/tasks/records)
    Notifications.tsx      # Notifications
    Onboarding.tsx         # 9-step wizard: welcome → name → role → location → language → (farmer: types/follow-ups/scale) → interests → done
    Profile.tsx            # Profile summary + inline edit form (name, bio, role, location, language, activities, crops, livestock, interests, phone)
    FarmAssistant.tsx      # AI assistant (chat, modes, image upload)
    ImageDiagnosis.tsx     # Dedicated camera/upload diagnosis screen (uses analyzeImage)
    FarmPlanner.tsx        # Tasks across all farm activities, grouped Overdue/Today/This Week/Later/Completed
    WeatherDetails.tsx     # Full weather screen — current, alerts, 7-day, 24-hour
    AdminDashboard.tsx     # Admin panel (role-gated)
  components/
    ui/                    # shadcn/ui base components
    farm/                  # ActivityTimeline, AddRecordSheet, CreateActivitySheet
    community/             # PostCard (share/delete/report/block), CreatePostSheet
    home/                  # QuickActions, SocialFeed, Weather, Alerts, News
    onboarding/            # Onboarding flow
  contexts/
    AuthContext.tsx        # Auth state — loads full profile from Supabase, handles OAuth redirects
  services/
    supabaseClient.ts      # Supabase client + signInWithGoogle()
  lib/
    supabaseService.ts     # ALL Supabase CRUD (two-step batch fetching, no FK joins)
    dataService.ts         # TypeScript types + localStorage auth fallback
    agricultureKnowledge.ts # AI knowledge base
  public/
    manifest.json          # PWA manifest
```

## Environment Variables
- `VITE_SUPABASE_URL` = https://gciybjlwambconeyhigk.supabase.co
- `VITE_SUPABASE_ANON_KEY` = (set in shared env)
- `VITE_GOOGLE_CLIENT_ID` = (set in shared env)

## Supabase SQL Schema (actual — matches real DB)
Run this block in Supabase SQL Editor only for tables that need creating.
The DB already has many of these tables. Check before running.

### Critical schema facts verified against real DB:
- `posts.user_id` = author (NOT NULL) — not `author_id`
- `posts.community_id` = NOT NULL — every post must belong to a community
- `posts.original_post_id` = self-FK for reposts/shares (not `shared_from_id`)
- `post_reactions`: columns `(post_id, user_id, type)` — PK is composite (post_id, user_id), NO separate id column; column is `type` not `reaction_type`
- `comments.user_id` = author (NOT NULL) — `author_id` is nullable secondary field
- `community_members.created_at` (NOT `joined_at`); NO unique constraint on (user_id, community_id)
- `communities`: has `image_url`, `creator_id`; NO `emoji`, `is_private`, `members_count` columns
- `marketplace_listings`: `user_id` (not `seller_id`), `contact_info` (not `phone`), price is numeric; NO `category` or `is_approved`
- `profiles`: only `country` + `region` for location (not `location`); NO `farming_types`, `avatar_url`, `bio`, `is_suspended`, `onboarding_completed` — avatar comes from auth.users metadata
- `notifications`: only `message` column; NO `title`, NO `avatar_url`; has `reference_id`
- `user_blocks` table does NOT exist — block feature is a no-op

```sql
-- 1. PROFILES (trigger-created on new auth user)
-- ACTUAL columns: id, email, full_name, role, country, region, farm_scale, created_at
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text, email text,
  role text default 'user',
  country text, region text, farm_scale text,
  created_at timestamptz default now()
);
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, full_name, email, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email,
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- 2. COMMUNITIES
create table if not exists communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  emoji text default '🌱',
  creator_id uuid references profiles(id) on delete cascade,
  members_count int default 1,
  is_private boolean default false,
  created_at timestamptz default now()
);

-- 3. COMMUNITY MEMBERS (join table)
create table if not exists community_members (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references communities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  unique(community_id, user_id)
);

-- 4. POSTS
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade,
  content text not null,
  image_url text,
  tag text,
  community_id uuid references communities(id) on delete set null,
  shared_from_id uuid references posts(id) on delete set null,
  shared_from_author_name text,
  shared_from_text text,
  likes_count int default 0,
  comments_count int default 0,
  is_reported boolean default false,
  created_at timestamptz default now()
);

-- 5. POST REACTIONS (idempotent — unique per user per post)
create table if not exists post_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- 6. COMMENTS
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- 7. USER BLOCKS
create table if not exists user_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- 8. MARKETPLACE
create table if not exists marketplace_listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) on delete cascade,
  title text not null, description text, price text,
  location text, category text, image_url text, phone text,
  is_approved boolean default true,
  created_at timestamptz default now()
);

-- 9. FARM TABLES
create table if not exists farm_activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text not null, name text not null,
  location text, size text, species text, start_date date,
  created_at timestamptz default now()
);
create table if not exists farm_tasks (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references farm_activities(id) on delete cascade,
  title text not null, due_date date,
  is_completed boolean default false, category text
);
create table if not exists farm_records (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references farm_activities(id) on delete cascade,
  type text, description text, date date, quantity text
);

-- 10. NOTIFICATIONS
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text, title text, message text,
  is_read boolean default false, avatar_url text,
  created_at timestamptz default now()
);

-- ENABLE ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table communities enable row level security;
alter table community_members enable row level security;
alter table posts enable row level security;
alter table post_reactions enable row level security;
alter table comments enable row level security;
alter table user_blocks enable row level security;
alter table marketplace_listings enable row level security;
alter table farm_activities enable row level security;
alter table farm_tasks enable row level security;
alter table farm_records enable row level security;
alter table notifications enable row level security;

-- RLS POLICIES
create policy "Public read profiles" on profiles for select using (true);
create policy "Own update profile" on profiles for update using (auth.uid() = id);
create policy "Public read communities" on communities for select using (true);
create policy "Auth create community" on communities for insert with check (auth.uid() = creator_id);
create policy "Admin update community" on communities for update using (auth.uid() = creator_id);
create policy "Admin delete community" on communities for delete using (auth.uid() = creator_id);
create policy "Public read members" on community_members for select using (true);
create policy "Auth join community" on community_members for insert with check (auth.uid() = user_id);
create policy "Auth leave community" on community_members for delete using (auth.uid() = user_id);
create policy "Public read posts" on posts for select using (true);
create policy "Auth insert posts" on posts for insert with check (auth.uid() = author_id);
create policy "Own update posts" on posts for update using (auth.uid() = author_id);
create policy "Own delete posts" on posts for delete using (auth.uid() = author_id);
create policy "Auth reactions" on post_reactions for all using (auth.uid() = user_id);
create policy "Public read comments" on comments for select using (true);
create policy "Auth insert comments" on comments for insert with check (auth.uid() = author_id);
create policy "Own delete comment" on comments for delete using (auth.uid() = author_id);
create policy "Own blocks" on user_blocks for all using (auth.uid() = blocker_id);
create policy "Public read listings" on marketplace_listings for select using (true);
create policy "Auth insert listings" on marketplace_listings for insert with check (auth.uid() = seller_id);
create policy "Own delete listing" on marketplace_listings for delete using (auth.uid() = seller_id);
create policy "Own farm activities" on farm_activities for all using (auth.uid() = user_id);
create policy "Own farm tasks" on farm_tasks for all using (
  activity_id in (select id from farm_activities where user_id = auth.uid())
);
create policy "Own farm records" on farm_records for all using (
  activity_id in (select id from farm_activities where user_id = auth.uid())
);
create policy "Own notifications" on notifications for all using (auth.uid() = user_id);
```

## Social System Architecture

### Query Strategy
All post/comment/listing queries use **two-step batch fetching** — never Supabase FK join syntax (`profiles!author_id`), which requires FK constraints in the schema cache. Instead:
1. Fetch rows from the primary table
2. Collect unique user IDs
3. Batch-fetch profiles with `.in("id", uniqueIds)`
4. Join in JavaScript via Map

### Features Implemented
- **Posts**: Create, delete (own), report, optimistic updates on like/comment
- **Comments**: Create with optimistic UI, load on expand
- **Reactions**: Idempotent like/dislike (unique DB constraint), returns new count
- **Sharing/Reposts**: Creates a new post with `shared_from_id` reference, shows original attribution
- **Communities**: Create, join, leave, browse (Your Communities + Discover), filter feed by community
- **Community Admin**: Edit details, delete community, remove members, promote to admin
- **User Blocks**: Block users from post menu — blocks stored in Supabase, filtered at query level
- **Notifications**: Created on like, comment events

### React Query Keys
- `["/api/posts"]` — all posts (global feed)
- `["/api/posts", communityId]` — community-filtered feed
- `["/api/communities", userId]` — communities list with membership
- `["/api/community-members", communityId]` — community member list
- `["/api/blocks", userId]` — blocked user IDs

## Auth Architecture
1. **Supabase Auth (primary)** — Google OAuth + email/password via Supabase
2. `AuthContext` loads full profile from `profiles` table on every session
3. Handles OAuth redirects: new users → `/onboarding`, returning users → `/`
4. **Local email/password fallback** — still works via localStorage for testing
5. **Admin access**: Set `role = 'admin'` in `profiles` table for any user

## Google OAuth
- Redirect hardcoded to `https://my-harvest.vercel.app`
- Must also be added as authorized redirect URI in Supabase Auth → URL Configuration

## Key Design Decisions
- No hardcoded seed data — platform starts with empty states
- All 47 Kenyan counties in onboarding
- Guest users can browse posts/marketplace, cannot post/comment/manage farms
- FK joins avoided — all joins done in JS with batch queries for maximum compatibility
- Optimistic updates on post creation with rollback on failure
- `communityId` filter chip strip on feed for community-scoped browsing

## Farm Intelligence Engine (April 2026)
Unified server-side decision layer that fuses **profile + farm activities + weather + agri-news** into a single Mistral-7B reasoning call. Frontend makes ONE network request — no client-side orchestration of weather/news/AI for this view.

### Architecture
```
                 ┌──────────────────────────────────┐
   <Home>        │   ai-gateway/farm-intel          │
   FarmIntel ──▶ │   (Supabase Edge Function)       │
                 ├──────────────────────────────────┤
                 │  1. Verify caller's JWT          │
                 │  2. Read profiles, farm_         │
                 │     activities, tasks,           │
                 │     farm_records (service-role)  │
                 │  3. Read weather_cache (30 m TTL)│
                 │     fallback → Open-Meteo geo+   │
                 │     forecast, persist back       │
                 │  4. Read RSS news (6 h cache,    │
                 │     in-memory) — region-filtered │
                 │  5. Build structured context     │
                 │  6. Single Mistral-7B call →     │
                 │     parse strict JSON            │
                 │  7. Persist alerts in farm_      │
                 │     intelligence_alerts          │
                 │  8. On AI failure → heuristic    │
                 │     fallback (never silent)      │
                 └──────────────────────────────────┘
```

### Files
- **Edge Function**: `supabase/functions/ai-gateway/index.ts` — new `farm-intel` route added; existing `/text`, `/image`, `/embed`, `/news` routes unchanged
- **Migration**: `supabase/migrations/20260428_farm_intelligence.sql` — creates `weather_cache` + `farm_intelligence_alerts` (additive, `IF NOT EXISTS`, RLS scoped per user)
- **Service**: `src/services/farmIntelService.ts` — single `fetchFarmIntelligence()` call, 5-min client cache
- **UI**: `src/components/home/FarmIntelligence.tsx` — risk-coloured card with headline, alerts, recommendations, farm-action targets, expandable reasoning
- **Wired in**: `src/pages/Index.tsx` (top of authenticated home, above WeatherWidget)

### Output JSON contract
```jsonc
{
  "risk_level": "low" | "medium" | "high",
  "headline": "single sentence",
  "alerts": [{ "type": "weather|pest|disease|market|general",
               "severity": "low|medium|high",
               "title": "...", "message": "...",
               "source": "weather|news|ai|farm" }],
  "recommendations": ["…", "…"],
  "farm_actions":    [{ "activity": "…", "action": "…", "due_within_days": 3 }],
  "reasoning": "2-4 sentences explaining how the signals combined"
}
```

### Caching strategy (priority: cached + structured > raw API)
| Layer | TTL | Where |
|---|---|---|
| Frontend in-memory | 5 min | `farmIntelService.ts` |
| Backend reuse of last alert row | 1 h | `farm_intelligence_alerts` (skip Mistral if recent) |
| `weather_cache` | 30 min | per (region\|country) location key |
| News RSS | 6 h | in-memory, per Edge Function instance |

### Failure handling (degrades gracefully, never silent)
- No JWT → returns `error: "missing_authorization"` with 502
- AI fails / returns invalid JSON → heuristic fallback from weather signals + overdue tasks; surfaced to UI as `aiSource: "fallback"`
- Weather API down → context built without it, `reasoning` mentions the gap
- News fetch fails → context built without it
- `weather_cache` table missing → upsert/select wrapped in try/catch — function still works

### Deployment (one-time, manual — keeps backend ops separate from app code)
```bash
# 1. Apply additive migration (non-destructive, IF NOT EXISTS guards)
supabase db push
#   or paste supabase/migrations/20260428_farm_intelligence.sql
#   into Supabase Dashboard → SQL Editor

# 2. Redeploy the Edge Function
supabase functions deploy ai-gateway --no-verify-jwt
#   (--no-verify-jwt matches existing config.toml so anon-key calls still
#    reach the function; the farm-intel handler validates the JWT manually
#    via supabase.auth.getUser())
```

The Edge Function automatically receives `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from Supabase's default secret set — no extra env vars to configure. `HF_API_KEY` must already be set (it powers the existing `/text` route).

### Constraints honoured
- ✅ No changes to auth, existing tables, RLS policies, or API keys
- ✅ Only ADDITIVE tables (`weather_cache`, `farm_intelligence_alerts`)
- ✅ Existing Edge Function routes (`/text`, `/image`, `/embed`, `/news`) unchanged
- ✅ Frontend single-endpoint contract — no client-side fusion logic
- ✅ Weather + news now feed AI reasoning, not just UI cards

## Hardening Pass (April 2026)
- **Image upload safety** (`aiService.callBackendImage`):
  - Replaced `btoa(String.fromCharCode(...bytes))` with chunked 32 KB encoder (`fileToBase64`) — avoids stack-overflow crash on images > ~100 KB
  - Added client-side `compressImage` (canvas resize to 1280 px max, JPEG q=0.85, target < 1 MB) so we never POST oversized payloads to the Edge Function
- **AI gateway error categorization** (`describeGatewayError`):
  - 401 → "AI service is not authorized"; 429 → rate-limited; 503 → unavailable; network → "check your connection". Replaces opaque `error.message` passthrough in both text and image calls
  - `FarmAssistant` chat surfaces friendly messages mapped from these categories instead of a generic "couldn't process"
- **Image input validation** (`FarmAssistant.ImageUploadBar`): now enforces image MIME type + 8 MB cap with `sonner` toasts (was silently accepting anything)
- **Farm Planner timezone safety** (`parseLocalDate`): `YYYY-MM-DD` strings parsed as local midnight (not UTC), so date buckets are correct in any timezone
- **Farm Planner ↔ Weather integration**: top severe-weather alert banner at top of `/planner`, links to `/weather` for detail
- **Dead-click cleanup**:
  - Removed non-functional `SlidersHorizontal` filter button on Marketplace; added a working "Clear" button on the search input
  - Replaced `alert()` in Marketplace listing creation with `sonner` toast (success + error)
  - Removed dead "See all" button on AgriNews home card (it WAS the news section)
- **React Query defaults** (`App.tsx`): `staleTime: 60 s`, `gcTime: 5 min`, `refetchOnWindowFocus: false`, `retry: 1` — eliminates accidental refetches on tab focus
- **Note on news/AI gateway 401s**: Edge Function `ai-gateway` is returning non-2xx responses in dev. Frontend handles gracefully (cached/stale fallback for news, knowledge-base fallback for AI). Backend redeploy / `HF_API_KEY` check is a separate ops task — not changed per project constraints.
