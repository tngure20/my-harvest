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
    Onboarding.tsx         # First-time onboarding (47 Kenyan counties)
    FarmAssistant.tsx      # AI assistant
    AdminDashboard.tsx     # Admin panel (role-gated)
  components/
    ui/                    # shadcn/ui base components
    farm/                  # ActivityTimeline, AddRecordSheet, CreateActivitySheet
    community/             # PostCard (share/delete/report/block), CreatePostSheet
    home/                  # SocialFeed, Weather, Alerts, News
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

## Supabase SQL Schema
Run this entire block in Supabase SQL Editor (Project → SQL Editor → New Query):

```sql
-- 1. PROFILES (trigger-created on new auth user)
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
