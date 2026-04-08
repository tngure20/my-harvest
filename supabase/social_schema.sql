-- ============================================================
-- Harvest: Social Layer Migration
-- Run this entire file in the Supabase SQL editor once.
-- ============================================================

-- ─── 1. Storage bucket for post media ─────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm']
) on conflict (id) do nothing;

create policy if not exists "Public can view post media"
  on storage.objects for select using (bucket_id = 'post-media');

create policy if not exists "Auth users can upload post media"
  on storage.objects for insert with check (
    bucket_id = 'post-media' and auth.uid() is not null
  );

create policy if not exists "Users delete own post media"
  on storage.objects for delete using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── 2. Communities ────────────────────────────────────────
create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  image_url    text,
  creator_id   uuid references public.profiles(id) on delete cascade not null,
  member_count integer default 1 not null,
  created_at   timestamptz default now() not null
);

alter table public.communities enable row level security;

create policy if not exists "Communities are public"
  on public.communities for select using (true);
create policy if not exists "Users create communities"
  on public.communities for insert with check (auth.uid() = creator_id);
create policy if not exists "Creators update communities"
  on public.communities for update using (auth.uid() = creator_id);
create policy if not exists "Creators delete communities"
  on public.communities for delete using (auth.uid() = creator_id);

-- ─── 3. Community members ──────────────────────────────────
create table if not exists public.community_members (
  community_id uuid references public.communities(id) on delete cascade not null,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  joined_at    timestamptz default now() not null,
  primary key (community_id, user_id)
);

alter table public.community_members enable row level security;

create policy if not exists "Members are public"
  on public.community_members for select using (true);
create policy if not exists "Users join communities"
  on public.community_members for insert with check (auth.uid() = user_id);
create policy if not exists "Users leave communities"
  on public.community_members for delete using (auth.uid() = user_id);

-- ─── 4. Posts ──────────────────────────────────────────────
create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade not null,
  text             text not null default '',
  image_url        text,
  video_url        text,
  tag              text default 'Discussion' not null,
  community_id     uuid references public.communities(id) on delete set null,
  original_post_id uuid references public.posts(id) on delete set null,
  like_count       integer default 0 not null,
  dislike_count    integer default 0 not null,
  comment_count    integer default 0 not null,
  created_at       timestamptz default now() not null
);

alter table public.posts enable row level security;

create policy if not exists "Posts are public"
  on public.posts for select using (true);
create policy if not exists "Users create own posts"
  on public.posts for insert with check (auth.uid() = user_id);
create policy if not exists "Users delete own posts"
  on public.posts for delete using (auth.uid() = user_id);
-- counts updated by trigger (security definer bypasses RLS)

-- ─── 5. Post reactions ─────────────────────────────────────
create table if not exists public.post_reactions (
  post_id    uuid references public.posts(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  type       text check (type in ('like','dislike')) not null,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);

alter table public.post_reactions enable row level security;

create policy if not exists "Reactions are public"
  on public.post_reactions for select using (true);
create policy if not exists "Users add reactions"
  on public.post_reactions for insert with check (auth.uid() = user_id);
create policy if not exists "Users update own reactions"
  on public.post_reactions for update using (auth.uid() = user_id);
create policy if not exists "Users delete own reactions"
  on public.post_reactions for delete using (auth.uid() = user_id);

-- ─── 6. Post comments ──────────────────────────────────────
create table if not exists public.post_comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid references public.posts(id) on delete cascade not null,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  text              text not null,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  created_at        timestamptz default now() not null
);

alter table public.post_comments enable row level security;

create policy if not exists "Comments are public"
  on public.post_comments for select using (true);
create policy if not exists "Users add comments"
  on public.post_comments for insert with check (auth.uid() = user_id);
create policy if not exists "Users delete own comments"
  on public.post_comments for delete using (auth.uid() = user_id);

-- ─── 7. Triggers: auto-update reaction counts ──────────────
create or replace function public.handle_reaction_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    if new.type = 'like' then
      update public.posts set like_count = like_count + 1 where id = new.post_id;
    else
      update public.posts set dislike_count = dislike_count + 1 where id = new.post_id;
    end if;

  elsif tg_op = 'DELETE' then
    if old.type = 'like' then
      update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    else
      update public.posts set dislike_count = greatest(dislike_count - 1, 0) where id = old.post_id;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.type = 'like' then
      update public.posts
        set like_count = like_count + 1,
            dislike_count = greatest(dislike_count - 1, 0)
        where id = new.post_id;
    else
      update public.posts
        set dislike_count = dislike_count + 1,
            like_count = greatest(like_count - 1, 0)
        where id = new.post_id;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reaction_count on public.post_reactions;
create trigger trg_reaction_count
  after insert or update or delete on public.post_reactions
  for each row execute function public.handle_reaction_count();

-- ─── 8. Trigger: auto-update comment count ─────────────────
create or replace function public.handle_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_comment_count on public.post_comments;
create trigger trg_comment_count
  after insert or delete on public.post_comments
  for each row execute function public.handle_comment_count();

-- ─── 9. Trigger: auto-update community member count ────────
create or replace function public.handle_member_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_member_count on public.community_members;
create trigger trg_member_count
  after insert or delete on public.community_members
  for each row execute function public.handle_member_count();
