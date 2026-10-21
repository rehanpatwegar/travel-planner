-- ==============================================================================
-- PROPOSAL (DO NOT EXECUTE / AUDIT ONLY): Transaction-Safe Trip Deletion RPC
-- File: db/proposals/rpc_delete_trip.sql
-- ==============================================================================
-- Description:
--   A PostgreSQL stored function that deletes a trip and all dependent child records
--   within a single atomic database transaction. If any delete fails, the entire
--   transaction is rolled back automatically, preventing partial deletion anomalies.
--
-- Note: Do NOT execute this script. Provided for architectural review only.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_trip_transactional(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- 1. Verify trip exists and user is the owner
  SELECT user_id INTO v_owner_id
  FROM public.trips
  WHERE id = p_trip_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id;
  END IF;

  IF v_owner_id <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: User % does not own trip %', p_user_id, p_trip_id;
  END IF;

  -- 2. Explicitly remove child records within this atomic transaction
  -- (Guarantees safety even if the live database schema is missing ON DELETE CASCADE)
  DELETE FROM public.shared_trips WHERE trip_id = p_trip_id;
  DELETE FROM public.expenses WHERE trip_id = p_trip_id;
  DELETE FROM public.itinerary_items WHERE trip_id = p_trip_id;
  DELETE FROM public.trip_stops WHERE trip_id = p_trip_id;

  -- 3. Delete the parent trip record
  DELETE FROM public.trips WHERE id = p_trip_id AND user_id = p_user_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Any failure automatically rolls back the entire transaction
    RAISE;
END;
$$;

