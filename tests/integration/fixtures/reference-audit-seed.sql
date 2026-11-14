-- Synthetic legacy-state setup ONLY. The privileged fixture administrator can
-- reproduce existing bad links without weakening the migrated user policies.
INSERT INTO public.boards(id, user_id, name) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'user_reference_audit_a', 'Synthetic legacy board');
INSERT INTO public.clothing_items(id, user_id, name, category, image_path) VALUES
  ('00000000-0000-4000-8000-0000000000a2', 'user_reference_audit_a', 'Synthetic owned clothing', 'Tops', 'user_reference_audit_a/original.png'),
  ('00000000-0000-4000-8000-0000000000b2', 'user_reference_audit_b', 'Synthetic foreign clothing', 'Tops', 'user_reference_audit_b/original.png');
INSERT INTO public.board_items(board_id, position, clothing_item_id, image_path_snapshot) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 0, '00000000-0000-4000-8000-0000000000a2', 'user_reference_audit_a/owned-snapshot.png'),
  ('00000000-0000-4000-8000-0000000000a1', 1, '00000000-0000-4000-8000-0000000000b2', 'user_reference_audit_a/legacy-snapshot.png'),
  ('00000000-0000-4000-8000-0000000000a1', 2, NULL, 'user_reference_audit_a/independent-snapshot.png');
