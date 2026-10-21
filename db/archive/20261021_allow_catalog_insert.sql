-- ==============================================================================
-- ARCHIVED / RETIRED MIGRATION FILE (DO NOT EXECUTE)
-- File: db/archive/20261021_allow_catalog_insert.sql
-- Status: RETIRED / SUPERSEDED BY ARCHITECTURAL DECISION
-- ==============================================================================
-- Architectural Decision (2026-10-21):
--   1. The global catalog (`public.cities` and `public.activities`) remains strictly
--      curated and read-only for standard authenticated and anonymous users (`FOR SELECT USING (true)`).
--      Ordinary authenticated users must NOT have direct INSERT policies on catalog tables.
--   2. User-specific destinations and custom activities are persisted to private trip
--      tables (`trip_stops.custom_city_name` and `itinerary_items`), protected by
--      per-user RLS policies.
--   3. `language_preference` and `saved_destinations` are omitted until actively required
--      by an implemented feature.
--
-- Notice: All executable SQL statements in this file have been commented out to prevent
-- accidental execution by migration tooling or SQL scripts.
-- ==============================================================================

/*
-- 1. Enable authenticated users to insert new cities into the global catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'cities' 
      AND policyname = 'Authenticated users can insert cities'
  ) THEN
    CREATE POLICY "Authenticated users can insert cities"
      ON public.cities FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Enable authenticated users to insert new activities into the global catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'activities' 
      AND policyname = 'Authenticated users can insert activities'
  ) THEN
    CREATE POLICY "Authenticated users can insert activities"
      ON public.activities FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Extend profiles table with optional language preferences and saved destinations
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS language_preference varchar(10) NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS saved_destinations jsonb NOT NULL DEFAULT '[]'::jsonb;
*/

