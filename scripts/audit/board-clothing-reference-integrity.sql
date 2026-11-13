-- Owner-run production preflight. Counts only: do not export IDs, paths, or rows.
-- Uses the audited schema. No writes, policy changes, or persistent settings.
-- row_security=off DOES NOT disable RLS: it errors if RLS would hide rows,
-- preventing an unprivileged/incomplete scan from being reported as zero.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
SET LOCAL row_security = off;

WITH reference_rows AS (
  SELECT bi.clothing_item_id,
    bi.image_path_snapshot IS NOT NULL AND bi.image_path_snapshot <> '' AS has_snapshot_path,
    b.id IS NULL AS missing_board,
    c.id IS NULL AS missing_clothing,
    b.user_id IS NULL OR c.user_id IS NULL AS missing_owner,
    b.user_id IS DISTINCT FROM c.user_id AS different_owners
  FROM public.board_items AS bi
  LEFT JOIN public.boards AS b ON b.id = bi.board_id
  LEFT JOIN public.clothing_items AS c ON c.id = bi.clothing_item_id
), classified AS (
  SELECT *, clothing_item_id IS NOT NULL AND
    (missing_board OR missing_clothing OR missing_owner OR different_owners) AS invalid_reference
  FROM reference_rows
)
SELECT json_build_object(
  'inspected_at', statement_timestamp(),
  'total_board_items', count(*),
  'null_clothing_references', count(*) FILTER (WHERE clothing_item_id IS NULL),
  'non_null_clothing_references', count(*) FILTER (WHERE clothing_item_id IS NOT NULL),
  'cross_owner_references', count(*) FILTER (WHERE clothing_item_id IS NOT NULL
    AND NOT missing_board AND NOT missing_clothing AND different_owners),
  'missing_board_references', count(*) FILTER (WHERE clothing_item_id IS NOT NULL AND missing_board),
  'missing_clothing_references', count(*) FILTER (WHERE clothing_item_id IS NOT NULL AND missing_clothing),
  'missing_owner_references', count(*) FILTER (WHERE clothing_item_id IS NOT NULL
    AND NOT missing_board AND NOT missing_clothing AND missing_owner),
  'invalid_reference_count', count(*) FILTER (WHERE invalid_reference),
  'invalid_references_with_snapshot_path', count(*) FILTER (WHERE invalid_reference AND has_snapshot_path),
  'invalid_references_without_snapshot_path', count(*) FILTER (WHERE invalid_reference AND NOT has_snapshot_path)
) AS reference_integrity
FROM classified;

ROLLBACK;
