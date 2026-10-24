-- Owner-run evidence collection only. Inspect/sanitize output before committing it:
-- policies and function bodies can contain literals or privileged configuration.
-- This exports catalog definitions, never application rows or secret tables.
BEGIN TRANSACTION READ ONLY;

SELECT rolname, rolsuper, rolbypassrls, rolinherit FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role') ORDER BY rolname;

SELECT pg_get_userbyid(roleid) AS granted_role, pg_get_userbyid(member) AS member_role, admin_option
FROM pg_auth_members
WHERE pg_get_userbyid(member) IN ('anon', 'authenticated', 'service_role')
ORDER BY member_role, granted_role;

SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('clothing_items', 'boards', 'board_items')
ORDER BY table_name, ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p')
  AND c.relname IN ('clothing_items', 'boards', 'board_items', 'objects', 'buckets')
ORDER BY schema_name, table_name;

SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname,
       pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('clothing_items', 'boards', 'board_items')
ORDER BY table_name, k.conname;

SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('clothing_items', 'boards', 'board_items')
ORDER BY tablename, indexname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('clothing_items', 'boards', 'board_items'))
   OR (schemaname = 'storage' AND tablename IN ('objects', 'buckets'))
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE (table_schema = 'public' AND table_name IN ('clothing_items', 'boards', 'board_items'))
   OR (table_schema = 'storage' AND table_name IN ('objects', 'buckets'))
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('clothing_items', 'boards', 'board_items')
ORDER BY table_name, column_name, grantee, privilege_type;

SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema IN ('public', 'auth')
ORDER BY routine_schema, routine_name, grantee;

SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname,
       pg_get_triggerdef(t.oid) AS definition,
       pg_get_functiondef(t.tgfoid) AS trigger_function
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'storage')
  AND c.relname IN ('clothing_items', 'boards', 'board_items', 'objects', 'buckets')
ORDER BY schema_name, table_name, t.tgname;

-- Review all public functions for policy helpers/RPC access. Definitions may be
-- sensitive: do not commit raw output. Include auth.jwt for owner-default review.
SELECT n.nspname AS schema_name, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f' AND (n.nspname = 'public' OR (n.nspname = 'auth' AND p.proname = 'jwt'))
ORDER BY schema_name, p.proname, arguments;

ROLLBACK;
