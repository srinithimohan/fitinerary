-- Sanitized replay of owner-provided catalog evidence. Test-only; never apply remotely.

-- Source: local audit CSV, 11 sections / 231 entries, reviewed 2026-11-09.

-- Storage internals come from the pinned service migrations, not reconstructed tables.

BEGIN;

-- These four role attributes are copied from the owner-provided role export.
ALTER ROLE anon NOSUPERUSER INHERIT NOLOGIN NOBYPASSRLS;
ALTER ROLE authenticated NOSUPERUSER INHERIT NOLOGIN NOBYPASSRLS;
ALTER ROLE authenticator NOSUPERUSER NOINHERIT LOGIN NOBYPASSRLS;
ALTER ROLE service_role NOSUPERUSER INHERIT NOLOGIN BYPASSRLS;

-- The export records explicit self grant-options on the Storage owner. The
-- pinned migrations omit these redundant owner bits; replay the actual ACL.
SET LOCAL ROLE supabase_storage_admin;
GRANT ALL ON storage.objects, storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
RESET ROLE;

CREATE TABLE public."clothing_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text DEFAULT (auth.jwt() ->> 'sub'::text) NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "image_path" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."boards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text DEFAULT (auth.jwt() ->> 'sub'::text) NOT NULL,
  "name" text DEFAULT 'Untitled Board'::text NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."board_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "board_id" uuid NOT NULL,
  "position" smallint NOT NULL,
  "clothing_item_id" uuid,
  "image_path_snapshot" text NOT NULL,
  "name_snapshot" text,
  "category_snapshot" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."board_items" ADD CONSTRAINT "board_items_board_id_position_key" UNIQUE (board_id, "position");


ALTER TABLE public."board_items" ADD CONSTRAINT "board_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."board_items" ADD CONSTRAINT "board_items_position_check" CHECK ((("position" >= 0) AND ("position" <= 8)));

ALTER TABLE public."boards" ADD CONSTRAINT "boards_pkey" PRIMARY KEY (id);

ALTER TABLE public."clothing_items" ADD CONSTRAINT "clothing_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."board_items" ADD CONSTRAINT "board_items_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

ALTER TABLE public."board_items" ADD CONSTRAINT "board_items_clothing_item_id_fkey" FOREIGN KEY (clothing_item_id) REFERENCES clothing_items(id) ON DELETE SET NULL;

ALTER TABLE public."clothing_items" OWNER TO postgres;

ALTER TABLE public."clothing_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."clothing_items" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public."clothing_items" FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON public."clothing_items" TO anon, authenticated, service_role;

ALTER TABLE public."boards" OWNER TO postgres;

ALTER TABLE public."boards" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."boards" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public."boards" FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON public."boards" TO anon, authenticated, service_role;

ALTER TABLE public."board_items" OWNER TO postgres;

ALTER TABLE public."board_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."board_items" NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public."board_items" FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON public."board_items" TO anon, authenticated, service_role;

CREATE POLICY "Users can add items to their own boards" ON "public"."board_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM boards
  WHERE ((boards.id = board_items.board_id) AND (boards.user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))));

CREATE POLICY "Users can delete items from their own boards" ON "public"."board_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM boards
  WHERE ((boards.id = board_items.board_id) AND (boards.user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))));

CREATE POLICY "Users can update items on their own boards" ON "public"."board_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM boards
  WHERE ((boards.id = board_items.board_id) AND (boards.user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM boards
  WHERE ((boards.id = board_items.board_id) AND (boards.user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))));

CREATE POLICY "Users can view items on their own boards" ON "public"."board_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM boards
  WHERE ((boards.id = board_items.board_id) AND (boards.user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))));

CREATE POLICY "Users can create their own boards" ON "public"."boards" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can delete their own boards" ON "public"."boards" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can update their own boards" ON "public"."boards" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id)) WITH CHECK ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can view their own boards" ON "public"."boards" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can create their own clothing" ON "public"."clothing_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can delete their own clothing" ON "public"."clothing_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can update their own clothing" ON "public"."clothing_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id)) WITH CHECK ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can view their own clothing" ON "public"."clothing_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT (auth.jwt() ->> 'sub'::text)) = user_id));

CREATE POLICY "Users can delete their own clothing images" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'clothing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));

CREATE POLICY "Users can update their own clothing images" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'clothing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text))))) WITH CHECK (((bucket_id = 'clothing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));

CREATE POLICY "Users can upload their own clothing images" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'clothing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));

CREATE POLICY "Users can view their own clothing images" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'clothing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));

COMMIT;
