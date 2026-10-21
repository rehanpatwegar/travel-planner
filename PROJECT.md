# GlobeTrotter — Project Specification

## 1. Project Overview
**Project name:** GlobeTrotter  
**Problem statement:** PS-1 — GlobeTrotter: Empowering Personalized Travel Planning  
**Repository:** https://github.com/rehanpatwegar/travel-planner

GlobeTrotter is a responsive, AI-powered multi-city travel-planning web application. It helps users organize trips, manage destinations and activities, build day-wise itineraries, track budgets, view travel plans on a calendar, and share itineraries.

The application must be a functional travel-planning platform, not merely a landing page or chatbot.

## 2. Main User Journey
Login → Create Trip → Add Cities and Stops → Plan Activities → Review Itinerary, Budget and Calendar → Share Itinerary.

AI features assist users in generating and improving travel plans.

## 3. Required Features

### Authentication and profile
- Sign up and log in.
- Forgot-password flow.
- User profile and settings.

### Trip management
- Dashboard with trip summaries and recent trips.
- Create, view, edit and delete trips.
- Support multiple cities and travel dates per trip.

### Search
- Search and filter cities.
- Browse activities by category, cost and duration.
- Add cities and activities to a trip.

### Itinerary
- Plan activities day by day.
- Assign dates and times.
- Reorder stops and activities using drag and drop.
- Provide a clear itinerary view.

### Budget and calendar
- Display total trip cost and expense breakdowns.
- Show cost-per-day summaries and charts.
- Provide a calendar or timeline of planned activities.

### Sharing
- Create public, read-only itinerary links.
- Keep private trips protected from unauthorized access.

### AI features
1. **AI Trip Generator:** Generate a proposed itinerary from a natural-language request, destination, duration, budget, interests and number of travelers.
2. **AI Itinerary Optimizer:** Suggest improvements to budget, route order and activity timing.
3. **Conversational Trip Assistant:** Answer questions using the relevant saved trip data as context.

Validate AI-generated structured output before saving it. Do not present unverified prices, bookings or availability as confirmed facts.

### Optional
An admin dashboard may be added if time permits.

## 4. Final Technology Stack
- Frontend: Next.js App Router, React and TypeScript.
- Styling: Tailwind CSS.
- UI components: shadcn/ui.
- Charts: Recharts.
- Calendar: FullCalendar.
- Drag and drop: dnd-kit.
- Backend: Next.js API Routes.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- File storage: Supabase Storage.
- AI: Gemini API.
- Hosting: Vercel.
- Version control: Git and GitHub.

Use one Next.js application; do not create a separate Express or Spring Boot server.

## 5. Planned Project Structure

app/
- (auth)/login/
- (auth)/signup/
- (auth)/forgot-password/
- (app)/dashboard/
- (app)/trips/page.tsx
- (app)/trips/new/
- (app)/trips/[id]/builder/
- (app)/trips/[id]/view/
- (app)/trips/[id]/budget/
- (app)/trips/[id]/calendar/
- (app)/search/cities/
- (app)/search/activities/
- (app)/profile/
- (app)/admin/ (optional)
- share/[slug]/
- api/trips/
- api/stops/
- api/cities/
- api/activities/
- api/ai/generate/
- api/ai/optimize/
- api/ai/chat/
- layout.tsx
- page.tsx

Other directories:
- components/ui/
- components/trip/
- components/charts/
- components/ai/
- lib/
- db/schema.sql
- db/seed.sql
- public/
- docs/architecture/
- docs/screenshots/

Add standard Next.js configuration files as required. Create routes and supporting files incrementally when their implementation parts begin; do not create unnecessary empty placeholder pages.

## 6. Architecture
The responsive Next.js frontend communicates with Next.js API routes. Supabase provides PostgreSQL, authentication and file storage. Server-side API routes handle Gemini requests and validate AI output.

Main product areas:
- User journey: accounts, trips, itinerary, budget, calendar, profile and sharing.
- AI planning: generation, optimization and trip-context chat.
- Platform: frontend, API routes and Supabase services.

## 7. Twelve-Part Implementation Plan
0. Preparation: Supabase project, Gemini API key, GitHub repository and Node.js.
1. Project setup: Next.js, TypeScript, Tailwind, shadcn/ui, landing page and Supabase client configuration.
2. Database schema and seed data.
3. Login, signup and authentication.
4. Dashboard, create trip and My Trips.
5. City and activity search.
6. Itinerary builder and drag-and-drop.
7. Itinerary view and calendar.
8. Budget and charts.
9. Public sharing and profile.
10. AI trip generator.
11. AI itinerary optimizer and conversational assistant.
12. Testing, polish, deployment and README updates.

Implement one part at a time. Do not skip ahead without explicit approval.

## 8. Development and Security Rules
- Read this file before each implementation task.
- Keep code understandable and maintainable for a college student.
- Make pages responsive on mobile and desktop.
- Avoid unnecessary dependencies and rewrites.
- Keep UI, API, database and utility logic organized.
- Never hardcode secrets or API keys.
- Store local secrets in `.env.local` and ensure Git ignores that file.
- Never expose the Gemini API key or Supabase service-role key in client-side code.
- Apply Supabase Row Level Security to protect private user data.
- Validate input and AI-generated structured data.
- After each task, list changed files, commands to run and manual tests.
- Do not claim tests passed unless they were executed.
- Do not commit or push unless explicitly instructed.

## 9. Git and Workspace Rules
- Continue using the existing `travel-planner` repository.
- Do not run `git init` again.
- Do not create a nested `globetrotter` directory.
- Preserve existing files unless changes are necessary and explained.
- Never commit `.env.local` or other secrets.

## 10. Operational Setup, Migrations & Architecture Reference

### Environment Variables (Required in `.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`: Public HTTPS URL of the Supabase project.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous API key for client and server authentication.
- `GEMINI_API_KEY`: Server-side API key for Google Gemini model generation, optimization, and assistant features.
- `SUPABASE_SERVICE_ROLE_KEY` *(Optional / Administrative)*: Required strictly for backend administrative actions (such as complete user account deletion via `supabase.auth.admin.deleteUser`). Never expose to client-side code.

### Database Setup & Migrations
1. **Base Schema:** Apply `db/schema.sql` via Supabase SQL Editor to provision tables, indexes, triggers, and Row Level Security policies.
2. **Initial Catalog Seed:** Apply `db/seed.sql` to populate curated global destinations and benchmark activities.
3. **Catalog Governance & Isolation:** The global catalog (`cities`, `activities`) remains strictly curated and read-only for public and authenticated users. Custom user destinations and activities are saved to private trip tables (`trip_stops`, `itinerary_items`). Historical migration `db/archive/20261021_allow_catalog_insert.sql` is retired and must not be applied.

### Public Sharing vs. Private Trip Architecture
- **Curated Catalog (`cities`, `activities`):** Publicly discoverable destinations and benchmark activities.
- **Private Trip Data (`trip_stops`, `itinerary_items`, `expenses`):** Belongs strictly to the authenticated trip owner and protected by RLS. Custom stops and user-created activities stay within the user's private trip.
- **Public Itinerary Sharing (`/share/[slug]`):** Controlled by `trips.is_public`, `trips.share_slug`, and `shared_trips.is_active`. Read-only anonymous access reveals schedule, stops, and activities, while strictly hiding private budget expenses, personal notes, and account identity.

### Known Limitations & Guidance
- **Account Deletion:** Per Supabase Auth architecture, permanent user deletion requires administrative API access with service-role permissions. The UI directs users through an authenticated deletion workflow rather than insecure client-side deletion.
- **Storage Buckets:** User avatars support direct HTTPS image URLs. For direct file uploads, provision a public `avatars` bucket in Supabase Storage with upload policies restricted to `auth.uid() = (storage.foldername(name))[1]`.

