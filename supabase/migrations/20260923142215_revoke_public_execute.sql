/*
# Revoke PUBLIC execute on SECURITY DEFINER functions

Postgres grants EXECUTE on functions to PUBLIC by default. The previous REVOKE
from anon/authenticated was insufficient because PUBLIC still grants access.
This migration:
1. Revokes EXECUTE from PUBLIC on both functions.
2. Grants EXECUTE on is_admin() to authenticated only (needed by RLS policies).
3. Does NOT grant EXECUTE on handle_new_user() to anyone — it is a trigger function
   and runs with the owner's privileges via the trigger, not via direct calls.
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;