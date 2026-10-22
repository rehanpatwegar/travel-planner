-- ==============================================================================
-- Migration: GlobeTrotter Feature 3 — Group Trip Split (Part 1: Schema & RLS)
-- File: db/migrations/20261022_group_trip_split.sql
-- Date: 2026-10-22
-- ==============================================================================
-- Scope:
--   1. Create `public.trip_members` table for travel companions (owner + members).
--   2. Update `public.expenses` with `paid_by_member_id` and `split_type`.
--   3. Create `public.expense_splits` table for individual member cost shares.
--   4. Configure non-recursive Row Level Security (RLS) policies restricted to
--      the authenticated trip owner (Owner-Managed MVP).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create `public.trip_members` Table
-- Tracks travel companions per trip. Supports both linked Supabase users and
-- lightweight guest companions added by name.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trip_members IS 'Travel companions and participants associated with a trip for group planning and expense splitting.';

-- Prevent case-insensitive duplicate member names within the same trip
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_members_trip_display_name_lower
  ON public.trip_members (trip_id, lower(trim(display_name)));

-- Prevent duplicate linking of the same authenticated user profile to a trip
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_members_trip_user
  ON public.trip_members (trip_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON public.trip_members (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON public.trip_members (user_id);

-- Attach automatic updated_at timestamp trigger if the helper exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    DROP TRIGGER IF EXISTS set_trip_members_updated_at ON public.trip_members;
    CREATE TRIGGER set_trip_members_updated_at
      BEFORE UPDATE ON public.trip_members
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Update `public.expenses` Table
-- Adds payer tracking and split type while preserving all existing expense data.
-- ------------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_by_member_id uuid REFERENCES public.trip_members(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS split_type text NOT NULL DEFAULT 'equal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_expenses_split_type'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT check_expenses_split_type
      CHECK (split_type IN ('equal', 'custom'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses (paid_by_member_id);

-- ------------------------------------------------------------------------------
-- 3. Create `public.expense_splits` Table
-- Records each participant's individual monetary share for an expense.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_expense_splits_expense_member UNIQUE (expense_id, member_id)
);

COMMENT ON TABLE public.expense_splits IS 'Individual participant liability shares for a specific group expense.';

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member ON public.expense_splits (member_id);

-- ------------------------------------------------------------------------------
-- 4. Configure Row Level Security (RLS)
-- Owner-Managed MVP Model:
--   - Non-recursive: strictly joins to `trips` to verify `trips.user_id = auth.uid()`.
--   - Read & Write restricted to the authenticated trip owner.
--   - Public share links (/share/[slug]) do NOT grant read access to member debts.
--   - Anonymous and unauthorized authenticated users have zero access.
-- ------------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- Trip Members Policies
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

-- Expense Splits Policies
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

  