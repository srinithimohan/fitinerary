-- Approved ownership fix. Apply only to the disposable local stack until a
-- separate production rollout is authorized. The audited baseline is retained
-- under tests/integration/fixtures; this file is an additive migration artifact.
BEGIN;

ALTER POLICY "Users can add items to their own boards"
ON public.board_items
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = board_items.board_id
      AND boards.user_id = (SELECT auth.jwt()->>'sub')
  )
  AND (
    clothing_item_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clothing_items AS c
      WHERE c.id = board_items.clothing_item_id
        AND c.user_id = (SELECT auth.jwt()->>'sub')
    )
  )
);

-- Omitting USING preserves the original board-owner row-selection rule.
ALTER POLICY "Users can update items on their own boards"
ON public.board_items
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = board_items.board_id
      AND boards.user_id = (SELECT auth.jwt()->>'sub')
  )
  AND (
    clothing_item_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clothing_items AS c
      WHERE c.id = board_items.clothing_item_id
        AND c.user_id = (SELECT auth.jwt()->>'sub')
    )
  )
);

COMMIT;
