# GlobeTrotter

> **Your next adventure, thoughtfully planned.**

GlobeTrotter is a modern, responsive web application designed for multi-city travel planning. It centralizes route organization, day-by-day scheduling, expense tracking, calendar timelines, and AI-assisted recommendations into a unified, intuitive platform.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Database Setup](#database-setup)
- [Development Commands](#development-commands)
- [Security Guidelines](#security-guidelines)
- [Implementation Status](#implementation-status)

---

## Overview

Planning complex multi-city trips often forces travelers to juggle disconnected spreadsheets, maps, booking receipts, and notes. GlobeTrotter bridges this gap by providing an end-to-end travel workspace where you can:

1. **Map out multi-city routes** with dedicated arrival and departure dates.
2. **Structure day-by-day itineraries** with time-slotted activities and drag-and-drop reordering.
3. **Monitor travel budgets** across accommodation, transit, activities, and dining with real-time breakdowns.
4. **Inspect your schedule** across interactive agenda and calendar views.
5. **Leverage AI intelligence** to draft personalized itineraries, optimize route pacing, and answer trip-specific questions.
6. **Share read-only plans** with companions and family via secure links.

---

## Key Features

- **Multi-City Route Builder:** Connect multiple destinations in chronological sequence with flexible stay durations and transition buffers.
- **Day-by-Day Activity Scheduling:** Arrange morning, afternoon, and evening plans. Reorder activities with intuitive drag-and-drop.
- **Budget Tracking & Expense Breakdown:** Allocate category budgets, record expenses, and analyze cost-per-day visual breakdowns.
- **Interactive Calendar Timeline:** Switch between agenda, weekly, and monthly views to balance travel pacing and prevent scheduling conflicts.
- **AI Travel Intelligence (Gemini):** Generate structured trip proposals from natural descriptions, optimize stops and timing, and chat contextually with your saved trip data.
- **Read-Only Itinerary Sharing:** Share clean public links for friends and family while maintaining full privacy and edit-protection for your personal account.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript) |
| **Styling & Components** | [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Row Level Security) |
| **File Storage** | Supabase Storage |
| **AI Intelligence** | Google Gemini API (strictly server-side) |
| **Charts & Visualizations** | [Recharts](https://recharts.org/) *(Planned for Part 8)* |
| **Calendar Scheduling** | [FullCalendar](https://fullcalendar.io/) |
| **Drag & Drop** | [dnd-kit](https://dndkit.com/) |
| **Hosting & Deployment** | [Vercel](https://vercel.com/) |

---

## Project Structure

```text
travel-planner/
├── app/
│   ├── (auth)/                  # Authentication routes (login, signup, forgot-password)
│   ├── (app)/                   # Protected application routes
│   │   ├── dashboard/           # User trip dashboard and summaries
│   │   ├── trips/               # Trip list, new trip, builder, view, budget, calendar
│   │   ├── search/              # City and activity catalog search
│   │   └── profile/             # User settings and profile management
│   ├── share/[slug]/            # Public read-only itinerary view
│   ├── api/                     # Server-side API routes & AI endpoints
│   ├── globals.css              # Global styles & Tailwind theme variables
│   ├── layout.tsx               # Root layout & application metadata
│   └── page.tsx                 # Product landing page
├── components/
│   ├── ui/                      # Reusable primitive UI components (shadcn/ui)
│   ├── trip/                    # Trip cards, stops, and itinerary builders
│   ├── charts/                  # Budget and expense visualization components
│   └── ai/                      # AI generator modals and chat components
├── db/
│   ├── schema.sql               # Normalized PostgreSQL schema, constraints, indexes & RLS
│   └── seed.sql                 # Curated cities and activities sample data
├── lib/
│   ├── supabase/                # Browser and server Supabase client factories
│   └── utils.ts                 # Class merging utility (cn)
├── public/                      # Static assets and media
├── .env.example                 # Environment variable templates
└── package.json                 # Project dependencies and npm scripts
```

---

## Prerequisites

Before setting up the project locally, ensure you have:

- **Node.js:** `v18.18.0` or later (`v24.x` recommended)
- **npm:** `v9.x` or later (`v11.x` recommended)
- **Supabase Account:** A free [Supabase](https://supabase.com/) project for PostgreSQL and authentication.

---

## Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rehanpatwegar/travel-planner.git
   cd travel-planner
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy the example environment file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. **Add your credentials to `.env.local`:**
   ```env
   # Supabase Configuration (from Supabase Dashboard > Project Settings > API)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Server-side Secrets (used in later implementation parts)
   # SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   # GEMINI_API_KEY=your-gemini-api-key
   ```

---

## Database Setup

GlobeTrotter uses Supabase PostgreSQL with Row Level Security (RLS) enabled on all tables.

### 1. Apply Schema
1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New query**, open the local [`db/schema.sql`](file:///c:/Users/Rehan/Files%20needed/Buildathon/2.0/travel-planner/db/schema.sql) file, copy its contents, paste them into the editor, and click **Run**.
4. This creates all necessary tables, constraints, foreign keys, triggers, and Row Level Security policies:
   - `profiles` (synced automatically with `auth.users`)
   - `cities` (curated destinations catalog)
   - `activities` (curated attractions per city)
   - `trips` (user travel plans)
   - `trip_stops` (multi-city sequence)
   - `itinerary_items` (day-by-day scheduled plans)
   - `expenses` (budget tracking and categorized costs)
   - `shared_trips` (public read-only share configurations)

### 2. Apply Seed Data (Optional for Development)
1. In the Supabase **SQL Editor**, open [`db/seed.sql`](file:///c:/Users/Rehan/Files%20needed/Buildathon/2.0/travel-planner/db/seed.sql).
2. Copy and paste the script, then click **Run**.
3. This populates curated destinations (Paris, Lucerne, Florence, Tokyo, New York City, Barcelona) and their corresponding activities.

---

## Authentication Setup (Supabase Auth)

GlobeTrotter uses Supabase Auth with server-side cookie verification and SSR middleware.

### Required Supabase Dashboard Settings:
1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication → URL Configuration**.
3. **Site URL:**
   - Set to `http://localhost:3000` for local development.
   - Set to your custom domain or Vercel URL in production.
4. **Redirect URLs:** Add the following URLs to the whitelist:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - `http://localhost:3000/dashboard`
5. **Email Auth Configuration:**
   - Under **Authentication → Providers → Email**, ensure Email provider is enabled.
   - If *Confirm email* is enabled, users will receive a verification email upon signup before their session is activated.
   - If *Confirm email* is disabled, users will be logged in immediately upon registration.

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server at [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Compiles an optimized production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint 9 checks using flat config |

---

## Security Guidelines

- **Secrets Isolation:** Never commit `.env.local`, API keys, or database service-role keys to Git. Staged commits must never include private tokens.
- **Client vs. Server Credentials:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be referenced in browser-accessible client code.
- **Server-Side Protection:** The Gemini API key and Supabase Service Role key are strictly reserved for server-side API routes and Server Actions.
- **Row Level Security (RLS):** All user data tables enforce strict PostgreSQL RLS policies. Users can only query, modify, or delete their own trips, itinerary items, and expenses.

---

## Implementation Status

GlobeTrotter is developed through a structured, modular plan:

| Phase | Milestone | Status |
|---|---|---|
| **Part 1** | Project Setup, Next.js App Router, Tailwind CSS, shadcn/ui, Supabase Client & SaaS Landing Page | ✅ Completed |
| **Part 2** | Normalized Database Schema (`db/schema.sql`), Seed Data (`db/seed.sql`) & Enhanced Documentation | ✅ Completed |
| **Part 3** | Authentication (Supabase Auth Login, Signup, Forgot Password & Profiles) | ✅ Completed |
| **Part 4** | Dashboard, Trip Creation & My Trips Management | ✅ Completed |
| **Part 5** | City & Activity Catalog Search & Filters | ✅ Completed |
| **Part 6** | Day-by-Day Itinerary Builder & Drag-and-Drop Sequencing | ✅ Completed |
| **Part 7** | Detailed Itinerary View & Interactive Calendar Timeline | ✅ Completed |
| **Part 8** | Budget Analytics, Expense Logging & Visual Charts | ⏳ Planned |
| **Part 9** | Public Read-Only Sharing Links & Profile Settings | ⏳ Planned |
| **Part 10** | AI Trip Generator (Natural-Language Itinerary Generation) | ⏳ Planned |
| **Part 11** | AI Itinerary Optimizer & Context-Aware Trip Assistant | ⏳ Planned |
| **Part 12** | End-to-End Testing, UI Polish & Production Deployment | ⏳ Planned |

---

## License

This project is licensed under the MIT License.
