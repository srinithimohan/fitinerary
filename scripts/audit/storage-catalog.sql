-- Supabase-only, owner-run query. No object names, contents, keys, or user rows.
-- Sanitize bucket identifiers if they disclose private organization details.
BEGIN TRANSACTION READ ONLY;
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets ORDER BY id;
ROLLBACK;
