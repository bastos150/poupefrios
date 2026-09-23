/*
# Fix security warnings on helper functions

1. Set `search_path` on `is_admin()` and `handle_new_user()` via ALTER FUNCTION.
2. Revoke EXECUTE from `anon` on both functions.
3. Revoke EXECUTE from `authenticated` on `handle_new_user()` (trigger-only function).
   `authenticated` retains EXECUTE on `is_admin()` since RLS policies reference it.
*/

-- Fix is_admin: set search_path, revoke anon execute
ALTER FUNCTION is_admin() SET search_path = public;
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;

-- Fix handle_new_user: set search_path, revoke anon + authenticated execute
ALTER FUNCTION handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;