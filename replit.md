# Harvest - Agricultural Platform

## Overview
Harvest is a mobile-first React PWA for agricultural communities. It connects farmers, provides farm management tools, a marketplace, community features, and an AI farm assistant.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI)
- **Routing**: React Router v6
- **State/Data**: TanStack React Query
- **Auth/DB**: Supabase (PostgreSQL + Auth + Google OAuth)
- **Forms**: React Hook Form + Zod
- **PWA**: manifest.json (installable, mobile-first)

## Project Structure
```
src/
  App.tsx                  # Root component, routes
  main.tsx                 # Entry point
  pages/                   # Full page components
    Index.tsx              # Home page
    Community.tsx          # Community feed (Supabase posts)
    Marketplace.tsx        # Marketplace listings (Supabase)
    FarmManagement.tsx     # My Farm (Supabase farm_activities)
    Notifications.tsx      # Notifications (Supabase)
    Onboarding.tsx         # First-time user onboarding (saves to profiles)
    FarmAssistant.tsx      # AI assistant
    AdminDashboard.tsx     # Admin panel (role-gated)
  components/
    ui/                    # shadcn/ui base components
    farm/                  # Farm-specific components (ActivityTimeline uses Supabase records)
    community/             # PostCard (Supabase reactions/comments)
    home/                  # SocialFeed, Weather, Alerts, News
    onboarding/            # Onboarding flow (kenyan counties + countries)
  contexts/
    AuthContext.tsx        # Auth state — loads full profile from Supabase profiles table
  services/
    supabaseClient.ts      # Supabase client + signInWithGoogle()
    profileService.ts      # Profile sync on first auth
  lib/
    supabaseService.ts     # All Supabase CRUD (posts, comments, reactions, marketplace, farm, notifications)
    dataService.ts         # Type definitions + local auth fallback (no hardcoded seed data)
    agricultureKnowledge.ts # AI knowledge base
  public/
    manifest.json          # PWA manifest
```

## Environment Variables (set as shared env vars)
- `VITE_SUPABASE_URL` = https://gciybjlwambconeyhigk.supabase.co
- `VITE_SUPABASE_ANON_KEY` = (set in env)
- `VITE_GOOGLE_CLIENT_ID` = (set in env)

## Supabase Schema Required
Run this SQL in the Supabase dashboard SQL editor:

```sql
-- Profiles (trigger-created on new auth user)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text, email text, avatar_url text,
  location text, farming_types text[], farm_scale text,
  bio text, role text default 'farmer',
  is_suspended boolean default false,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, full_name, email, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Posts
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade,
  content text not null, image_url text, tag text,
  likes_count int default 0, comments_count int default 0,
  is_reported boolean default false, created_at timestamptz default now()
);

-- Post reactions
create table if not exists post_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  reaction_type text not null, created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- Comments
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade,
  content text not null, created_at timestamptz default now()
);

-- Marketplace
create table if not exists marketplace_listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) on delete cascade,
  title text not null, description text, price text,
  location text, category text, image_url text, phone text,
  is_approved boolean default true, created_at timestamptz default now()
);

-- Farm activities
create table if not exists farm_activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text not null, name text not null,
  location text, size text, species text, start_date date,
  created_at timestamptz default now()
);

-- Farm tasks
create table if not exists farm_tasks (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references farm_activities(id) on delete cascade,
  title text not null, due_date date, is_completed boolean default false, category text
);

-- Farm records
create table if not exists farm_records (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references farm_activities(id) on delete cascade,
  type text, description text, date date, quantity text
);

-- Notifications
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text, title text, message text,
  is_read boolean default false, avatar_url text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table posts enable row level security;
alter table post_reactions enable row level security;
alter table comments enable row level security;
alter table marketplace_listings enable row level security;
alter table farm_activities enable row level security;
alter table farm_tasks enable row level security;
alter table farm_records enable row level security;
alter table notifications enable row level security;

-- RLS policies (open read for public content, authenticated write)
create policy "Public read posts" on posts for select using (true);
create policy "Auth insert posts" on posts for insert with check (auth.uid() = author_id);
create policy "Auth delete own posts" on posts for delete using (auth.uid() = author_id);
create policy "Public read listings" on marketplace_listings for select using (true);
create policy "Auth insert listings" on marketplace_listings for insert with check (auth.uid() = seller_id);
create policy "Public read comments" on comments for select using (true);
create policy "Auth insert comments" on comments for insert with check (auth.uid() = author_id);
create policy "Auth reactions" on post_reactions for all using (auth.uid() = user_id);
create policy "Own farm activities" on farm_activities for all using (auth.uid() = user_id);
create policy "Own farm tasks" on farm_tasks for all using (
  activity_id in (select id from farm_activities where user_id = auth.uid())
);
create policy "Own farm records" on farm_records for all using (
  activity_id in (select id from farm_activities where user_id = auth.uid())
);
create policy "Own notifications" on notifications for all using (auth.uid() = user_id);
create policy "Own profile" on profiles for all using (auth.uid() = id);
```

## Auth Architecture
1. **Supabase Auth (primary)** — Google OAuth + email/password via Supabase. `AuthContext` loads the full profile from `profiles` table on every session.
2. **Local email/password fallback** — Still works via localStorage for accounts not in Supabase.

**Admin access**: Set `role = 'admin'` in the `profiles` table for any user.

## Google OAuth
- Redirect hardcoded to `https://my-harvest.vercel.app`
- Must also be added as an authorized redirect URI in Supabase Auth settings

## Key Design Decisions
- No hardcoded seed data — platform starts with empty states
- All 47 Kenyan counties supported in onboarding
- Guest users can browse posts and marketplace, but cannot post/comment/manage farms
- Onboarding is fully optional — all steps skippable
- PWA manifest enables "Add to Home Screen" on mobile
