-- ==============================================================================
-- Migration: Restrict Group Trip Split RLS Policies to Authenticated Role
-- File: db/migrations/20261022_group_trip_split_rls_authenticated.sql
-- Date: 2026-10-22
-- ==============================================================================
-- Purpose:
--   1. Explicitly target `TO authenticated` for all policies on `trip_members` and
--      `expense_splits` instead of defaulting to `PUBLIC`.
--   2. Ensure UPDATE policies have both `USING` (pre-update check) and `WITH CHECK`
--      (post-update check) expressions to prevent cross-trip reassignments.
--   3. Ensure anonymous (`anon`) requests are blocked before subqueries execute.
--   4. Preserve non-recursive policy structure and owner-managed MVP model.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update `public.trip_members` Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip owner can view trip members" ON public.trip_members;
CREATE POLICY "Trip owner can view trip members"
  ON public.trip_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can insert trip members" ON public.trip_members;
CREATE POLICY "Trip owner can insert trip members"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can update trip members" ON public.trip_members;
CREATE POLICY "Trip owner can update trip members"
  ON public.trip_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can delete trip members" ON public.trip_members;
CREATE POLICY "Trip owner can delete trip members"
  ON public.trip_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND trips.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 2. Update `public.expense_splits` Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trip owner can view expense splits" ON public.expense_splits;
CREATE POLICY "Trip owner can view expense splits"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      JOIN public.trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can insert expense splits" ON public.expense_splits;
CREATE POLICY "Trip owner can insert expense splits"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      JOIN public.trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can update expense splits" ON public.expense_splits;
CREATE POLICY "Trip owner can update expense splits"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      JOIN public.trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
        AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      JOIN public.trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
        AND trips.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip owner can delete expense splits" ON public.expense_splits;
CREATE POLICY "Trip owner can delete expense splits"
  ON public.expense_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      JOIN public.trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
        AND trips.user_id = auth.uid()
    )
  );

