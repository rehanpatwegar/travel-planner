-- ==============================================================================
-- GlobeTrotter — Database Schema (Supabase PostgreSQL)
-- ==============================================================================
-- Normalized schema for multi-city travel planning, day-by-day itineraries,
-- budget tracking, calendar scheduling, and secure read-only itinerary sharing.
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Automatic `updated_at` Timestamp Trigger
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------------------------
-- 2. User Profiles Table (`profiles`)
-- Linked directly to Supabase Auth `auth.users`.
-- ------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  home_currency varchar(3) not null default 'USD',
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Stores user profile metadata linked to Supabase auth accounts.';

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

-- Automatic profile creation on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to listen for new auth signups
create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. Cities Catalog Table (`cities`)
-- Curated global destinations available for search, discovery, and stops.
-- ------------------------------------------------------------------------------
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  country_code varchar(3),
  region text,
  description text,
  image_url text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  average_daily_cost numeric(10, 2) not null default 0.00 check (average_daily_cost >= 0),
  currency varchar(3) not null default 'USD',
  is_popular boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, country)
);

comment on table public.cities is 'Catalog of curated destinations with cost estimates and location data.';

create index idx_cities_name on public.cities(name);
create index idx_cities_country on public.cities(country);
create index idx_cities_popular on public.cities(is_popular) where is_popular = true;

-- ------------------------------------------------------------------------------
-- 4. Activities Catalog Table (`activities`)
-- Curated list of attractions, landmarks, and things to do per city.
-- ------------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (
    category in (
      'Sightseeing',
      'Food & Dining',
      'Culture & History',
      'Adventure',
      'Nature',
      'Entertainment',
      'Shopping',
      'Relaxation'
    )
  ),
  estimated_cost numeric(10, 2) not null default 0.00 check (estimated_cost >= 0),
  currency varchar(3) not null default 'USD',
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  image_url text,
  address text,
  rating numeric(3, 2) check (rating >= 0.0 and rating <= 5.0),
  created_at timestamptz not null default now(),
  unique (city_id, title)
);

comment on table public.activities is 'Catalog of curated activities that users can browse and add to itineraries.';

create index idx_activities_city on public.activities(city_id);
create index idx_activities_category on public.activities(category);
create index idx_activities_cost on public.activities(estimated_cost);

-- ------------------------------------------------------------------------------
-- 5. Trips Table (`trips`)
-- Core entity for multi-city travel plans created by users.
-- ------------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  end_date date,
  total_budget numeric(12, 2) not null default 0.00 check (total_budget >= 0),
  currency varchar(3) not null default 'USD',
  cover_image_url text,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_dates check (end_date is null or start_date is null or end_date >= start_date)
);

comment on table public.trips is 'User trips containing metadata, travel dates, overall budget, and sharing flags.';

create index idx_trips_user on public.trips(user_id);
create index idx_trips_dates on public.trips(start_date, end_date);
create index idx_trips_share_slug on public.trips(share_slug) where share_slug is not null;

create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. Trip Stops Table (`trip_stops`)
-- Represents destinations in a multi-city route and their stay sequence.
-- ------------------------------------------------------------------------------
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  city_id uuid references public.cities(id) on delete set null,
  custom_city_name text,
  order_index integer not null default 0 check (order_index >= 0),
  arrival_date date,
  departure_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_stop_dates check (departure_date is null or arrival_date is null or departure_date >= arrival_date),
  constraint check_city_presence check (city_id is not null or custom_city_name is not null)
);

comment on table public.trip_stops is 'Ordered city stops within a multi-city trip.';

create index idx_trip_stops_trip on public.trip_stops(trip_id);
create index idx_trip_stops_order on public.trip_stops(trip_id, order_index);

create trigger set_trip_stops_updated_at
before update on public.trip_stops
for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Itinerary Items Table (`itinerary_items`)
-- Day-by-day scheduled activities and plans within a trip.
-- Supports drag-and-drop ordering via `order_index`.
-- ------------------------------------------------------------------------------
create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_stop_id uuid references public.trip_stops(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  day_number integer not null check (day_number > 0),
  date date,
  title text not null,
  description text,
  category text not null default 'Sightseeing',
  start_time time,
  end_time time,
  order_index integer not null default 0 check (order_index >= 0),
  estimated_cost numeric(10, 2) not null default 0.00 check (estimated_cost >= 0),
  currency varchar(3) not null default 'USD',
  is_completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.itinerary_items is 'Day-by-day scheduled activities and timeline entries within a trip.';

create index idx_itinerary_trip on public.itinerary_items(trip_id);
create index idx_itinerary_day on public.itinerary_items(trip_id, day_number);
create index idx_itinerary_order on public.itinerary_items(trip_id, day_number, order_index);

create trigger set_itinerary_items_updated_at
before update on public.itinerary_items
for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. Expenses Table (`expenses`)
-- Tracks planned and actual costs against a trip budget with categories.
-- ------------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  title text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency varchar(3) not null default 'USD',
  category text not null check (
    category in (
      'Accommodation',
      'Activities',
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Miscellaneous'
    )
  ),
  expense_date date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expenses is 'Individual expenses and budgeted items for cost breakdowns and charts.';

create index idx_expenses_trip on public.expenses(trip_id);
create index idx_expenses_category on public.expenses(trip_id, category);
create index idx_expenses_date on public.expenses(trip_id, expense_date);

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 9. Publicly Shared Trips Table (`shared_trips`)
-- Manages read-only public sharing links and permissions.
-- ------------------------------------------------------------------------------
create table public.shared_trips (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  share_slug text not null unique,
  is_active boolean not null default true,
  allow_copy boolean not null default true,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

comment on table public.shared_trips is 'Configuration and analytics for publicly shared read-only itineraries.';

create unique index idx_shared_trips_slug on public.shared_trips(share_slug);
create index idx_shared_trips_trip on public.shared_trips(trip_id);

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================

-- 1. Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.activities enable row level security;
alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expenses enable row level security;
alter table public.shared_trips enable row level security;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- Users can only read and modify their own profile.
-- ------------------------------------------------------------------------------
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Cities Policies
-- Curated catalog: anyone (anon & authenticated) can view; only admins can write.
-- ------------------------------------------------------------------------------
create policy "Cities are viewable by all users"
  on public.cities for select
  using (true);

-- ------------------------------------------------------------------------------
-- Activities Policies
-- Curated catalog: anyone (anon & authenticated) can view; only admins can write.
-- ------------------------------------------------------------------------------
create policy "Activities are viewable by all users"
  on public.activities for select
  using (true);

-- ------------------------------------------------------------------------------
-- Trips Policies
-- Users can manage their own trips.
-- Publicly shared trips can be viewed in read-only mode by anyone.
-- ------------------------------------------------------------------------------
create policy "Users can view their own trips or active shared trips"
  on public.trips for select
  using (
    auth.uid() = user_id
    or (
      is_public = true
      and exists (
        select 1 from public.shared_trips
        where shared_trips.trip_id = trips.id
          and shared_trips.is_active = true
          and (shared_trips.expires_at is null or shared_trips.expires_at > now())
      )
    )
  );

create policy "Users can create their own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.trips for update
  using (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Trip Stops Policies
-- Managed by the trip owner. Publicly viewable if the trip is shared.
-- ------------------------------------------------------------------------------
create policy "Stops are viewable by trip owner or on shared trips"
  on public.trip_stops for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_stops.trip_id
        and (
          trips.user_id = auth.uid()
          or (
            trips.is_public = true
            and exists (
              select 1 from public.shared_trips
              where shared_trips.trip_id = trips.id
                and shared_trips.is_active = true
                and (shared_trips.expires_at is null or shared_trips.expires_at > now())
            )
          )
        )
    )
  );

create policy "Trip owner can insert stops"
  on public.trip_stops for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_stops.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can update stops"
  on public.trip_stops for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_stops.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can delete stops"
  on public.trip_stops for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_stops.trip_id
        and trips.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Itinerary Items Policies
-- Managed by the trip owner. Publicly viewable if the trip is shared.
-- ------------------------------------------------------------------------------
create policy "Itinerary items are viewable by trip owner or on shared trips"
  on public.itinerary_items for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_items.trip_id
        and (
          trips.user_id = auth.uid()
          or (
            trips.is_public = true
            and exists (
              select 1 from public.shared_trips
              where shared_trips.trip_id = trips.id
                and shared_trips.is_active = true
                and (shared_trips.expires_at is null or shared_trips.expires_at > now())
            )
          )
        )
    )
  );

create policy "Trip owner can insert itinerary items"
  on public.itinerary_items for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can update itinerary items"
  on public.itinerary_items for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can delete itinerary items"
  on public.itinerary_items for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Expenses Policies
-- Private to the trip owner only (financial privacy protection).
-- ------------------------------------------------------------------------------
create policy "Only trip owner can view expenses"
  on public.expenses for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = expenses.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can insert expenses"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = expenses.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can update expenses"
  on public.expenses for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = expenses.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can delete expenses"
  on public.expenses for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = expenses.trip_id
        and trips.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Shared Trips Policies
-- Active share links are viewable by anyone using the slug.
-- Creation and modification are restricted to the trip owner.
-- ------------------------------------------------------------------------------
create policy "Active shared trip links are viewable by anyone"
  on public.shared_trips for select
  using (
    (is_active = true and (expires_at is null or expires_at > now()))
    or exists (
      select 1 from public.trips
      where trips.id = shared_trips.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can manage share links"
  on public.shared_trips for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = shared_trips.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can update share links"
  on public.shared_trips for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = shared_trips.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Trip owner can delete share links"
  on public.shared_trips for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = shared_trips.trip_id
        and trips.user_id = auth.uid()
    )
  );
