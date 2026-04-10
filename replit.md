# Harvest — AI-Powered Agricultural Platform

## Overview
Harvest is a mobile-first React web application for Kenyan/East African farmers and agricultural communities. It provides farm management tools, an AI assistant for crop/livestock diagnosis, a marketplace, community forums, a farming toolkit with calculators, and offline-first capabilities.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix UI) + Framer Motion animations
- **Routing**: React Router v6
- **State/Data**: TanStack React Query
- **Auth/DB**: Supabase (PostgreSQL + Auth + Google OAuth)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

## Project Structure
```
src/
  App.tsx              # Root component, routes, ErrorBoundary wrapping
  main.tsx             # Entry point
  pages/
    Index.tsx          # Adaptive home dashboard (time-aware, farm-type specific)
    FarmAssistant.tsx  # AI assistant (diagnosis, advice, confidence badges, feedback)
    FarmManagement.tsx # Farm records, activities, tasks, livestock health log
    Community.tsx      # Social feed with expert request tags
    Marketplace.tsx    # Listings with trust indicators
    Toolkit.tsx        # Calculators: fertilizer, feed, irrigation, yield, profit, vaccines
    Profile.tsx
    Onboarding.tsx
    ...
  components/
    ErrorBoundary.tsx  # React error boundary for all key pages
    ui/                # shadcn/ui base components
    farm/              # Farm-specific components (CreateFarmRecordSheet)
    community/
      PostCard.tsx     # Expert tag badge, color-coded tags, share/react
      CreatePostSheet.tsx  # Expert Request tag option
    home/
      WeatherWidget.tsx    # Live weather + 5-day forecast + farm insights
      TodaysTasks.tsx      # Due/overdue tasks with offline sync indicator
      QuickActions.tsx     # Scan Crop, Add Record, Log Activity, Marketplace
      RegionalAlerts.tsx   # Priority-tiered alerts (critical/high/medium/low)
      FarmingAdvice.tsx    # Farm-type + seasonal (long/short rains) tips
    marketplace/
      ListingCard.tsx      # Business verified badge, listing age, trust indicators
  contexts/
    AuthContext.tsx    # Auth state — Supabase sessions (email/password + Google OAuth)
  services/
    supabaseClient.ts     # Supabase client
    profileService.ts     # User profile sync
    socialService.ts      # Supabase social data layer (posts, reactions, comments, communities)
    farmService.ts        # Supabase farm data layer + generateSmartTasks()
    aiService.ts          # AI assistant with knowledge base fallback
    weatherService.ts     # Weather data + farming insights (cached, mock, seasonal)
    offlineCache.ts       # Offline-first localStorage task cache with sync support
    systemLogger.ts       # localStorage error tracking and event logging
    marketplaceService.ts # Marketplace listings (localStorage-backed)
  lib/
    dataService.ts           # localStorage CRUD (legacy, some features)
    agricultureKnowledge.ts  # AI knowledge base fallback
    adminConfig.ts
    utils.ts
supabase/              # SQL schema files (run in Supabase SQL editor)
  social_schema.sql
  farm_schema.sql
  extended_schema.sql
```

## Supabase Tables
- `profiles` — User metadata (farm type, location, county)
- `posts`, `post_reactions`, `post_comments` — Social feed
- `communities`, `community_members` — Social groups
- `farm_records`, `farm_activities`, `farm_tasks`, `farm_notifications` — Farm management
- `ai_requests` — AI assistant interaction log

## Key Features
### AI Farm Assistant
- Multi-mode: crop advice, livestock advice, diagnosis, seasonal tips
- Confidence level badges (high/medium/low)
- "What to do next" steps panel for diagnoses
- Feedback mechanism (helpful/not helpful) on responses
- Stronger disclaimer for diagnosis results
- Image upload for crop/disease diagnosis

### Farm Management
- Farm records by type: crop, livestock, poultry, aquaculture, beekeeping, equipment
- Livestock & poultry specific: **Health Log** (vaccinations, treatments, weight checks, observations) stored in localStorage
- Smart auto-task generation based on harvest dates, health status, monthly checks
- Activity logging with completion tracking
- Yield forecast chart

### Farming Toolkit
- Fertilizer calculator (DAP/CAN by crop + area)
- Feed requirement calculator (by animal type + weight)
- Irrigation calculator (by crop + system efficiency)
- Yield estimator (by farming practice level)
- Profit/break-even calculator
- **Vaccination Scheduler**: Kenya-specific schedules for cattle, goats, sheep, pigs, chickens with vaccination log

### Home Dashboard
- Time-aware greeting, farm-type emoji, season detection (long/short rains)
- Today's Tasks widget with due/overdue status and offline sync badge
- Quick Actions: Scan Crop, Add Record, Log Activity, Marketplace
- Weather widget with 5-day forecast and farm-type insights
- Regional alerts with priority levels and dismissal

### Community
- Color-coded tags: Expert Request (amber/gold), Alert (red), Success Story (emerald)
- Expert tag filtering capability
- Post sharing, reactions, comments

### Marketplace
- Business verified badge on seller cards
- Listing age indicator ("New listing" or "Listed Xd ago")
- Location, pricing, availability display
- No hardcoded seed listings — shows proper EmptyState when no real listings exist
- One-time purge of legacy "seed-*" fake listings on first load (`purgeSeedData()`)

### Offline-First & Error Handling
- localStorage-backed offline task cache with pending sync indicators
- System logger for error tracking
- **Error boundaries** on all key pages (Home, FarmManagement, FarmAssistant, Community, Marketplace, Toolkit, Profile)

## Environment Variables (set as Replit shared env vars)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (full JWT)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID (optional)
- `VITE_APP_URL` — App URL (update after deploying)

## Running the App
- Development: `npm run dev` (serves on port 8080, mapped to external port 80)
- Build: `npm run build`

## Key Notes
- Pure frontend SPA — no custom Node.js server. Supabase is the backend.
- Target audience: Kenyan/East African farmers. Currency: KES. Long rains = Mar–May, Short rains = Oct–Dec.
- Vite configured with `host: "0.0.0.0"`, `allowedHosts: true` for Replit proxy.
- Google OAuth redirect must include the Replit dev domain in Supabase's allowed redirect URLs.
- Marketplace is currently localStorage-backed (not yet Supabase). Farm records use Supabase.
- Health logs (livestock) and vaccination records are localStorage-only (per-device).
