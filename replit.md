# Harvest - Agricultural Platform

## Overview
Harvest is a mobile-first React web application for agricultural communities. It connects farmers, provides farm management tools, a marketplace, community features, and an AI farm assistant.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI)
- **Routing**: React Router v6
- **State/Data**: TanStack React Query
- **Auth/DB**: Supabase (PostgreSQL + Auth + Google OAuth)
- **Forms**: React Hook Form + Zod

## Project Structure
```
src/
  App.tsx              # Root component, routes
  main.tsx             # Entry point
  pages/               # Full page components (Index, Login, Signup, etc.)
  components/          # Reusable UI components
    ui/                # shadcn/ui base components
    farm/              # Farm-specific components
    community/         # Community components
    home/              # Home page components
    onboarding/        # Onboarding flow components
  contexts/
    AuthContext.tsx    # Auth state — handles local email/password AND Supabase OAuth sessions
  services/
    supabaseClient.ts  # Supabase client + signInWithGoogle() helper
    profileService.ts  # User profile sync
    socialService.ts   # Supabase social data layer (posts, reactions, comments, communities, media)
    aiService.ts       # AI farm assistant with fallback knowledge base
    newsService.ts     # Location-aware agri news (4-tier: county→national→regional→global)
  lib/
    dataService.ts     # localStorage CRUD still used by marketplace, farm, admin features
    agricultureKnowledge.ts  # AI knowledge base fallback
    utils.ts
  hooks/               # Custom React hooks
```

## Social / Community Features (Supabase-backed)
Tables: `posts`, `post_reactions`, `post_comments`, `communities`, `community_members`
- SQL migration: `supabase/social_schema.sql` — run once in Supabase SQL editor
- Storage bucket: `post-media` (public, 10 MB limit, image/video)
- Database triggers auto-maintain `like_count`, `dislike_count`, `comment_count`, `member_count`
- RLS policies: readable by all, mutations only by authenticated owners
- Routes: `/community` (feed + community cards), `/community/:id` (community detail page)
- Components: `PostCard`, `CreatePostSheet`, `CreateCommunitySheet`, `SocialFeed` (home widget)
- All social data flows through `src/services/socialService.ts`

## Environment Variables (set as shared env vars)
- `VITE_SUPABASE_URL` = https://gciybjlwambconeyhigk.supabase.co
- `VITE_SUPABASE_ANON_KEY` = sb_publishable_KiQb_bzkykVoxWnD4cX5jA_8XT0alXQ
- `VITE_GOOGLE_CLIENT_ID` = 506962736220-7j30f6ss1n6nch9h45nlnus9rrfnjpj4.apps.googleusercontent.com

## Auth Architecture
The app has two auth layers that work together:
1. **Local email/password auth** — stored in localStorage via AuthContext
2. **Supabase OAuth (Google)** — AuthContext listens to `supabase.auth.onAuthStateChange` and maps Supabase users to the local User type automatically

Google OAuth flow: User clicks → Supabase → Google → back to `window.location.origin`

## Supabase Configuration
- Project URL: https://gciybjlwambconeyhigk.supabase.co
- OAuth callback: https://gciybjlwambconeyhigk.supabase.co/auth/v1/callback
- Replit dev domain must be in Supabase's allowed redirect URLs

## Running the App
- Development: `npm run dev` (serves on port 5000)
- Build: `npm run build`

## Key Notes
- Migrated from Lovable to Replit — `lovable-tagger` plugin removed from vite config
- Vite configured for Replit: `host: "0.0.0.0"`, `port: 5000`, `allowedHosts: true`
- The floating `GoogleLoginButton` component was removed from App.tsx; Google sign-in is embedded directly in Login and Signup pages
