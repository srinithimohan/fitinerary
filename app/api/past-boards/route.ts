import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/app/lib/supabase';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  const supabase =
    createServerSupabaseClient();

  const {
    data: boards,
    error: boardsError,
  } = await supabase
    .from('boards')
    .select(`
      id,
      name,
      is_public,
      created_at,
      board_items (
        id,
        position,
        clothing_item_id,
        image_path_snapshot,
        name_snapshot,
        category_snapshot
      )
    `)
    .order('created_at', {
      ascending: false,
    });

  if (boardsError) {
    return NextResponse.json(
      {
        error: `Could not load boards: ${boardsError.message}`,
      },
      { status: 500 }
    );
  }

  const savedBoards =
    await Promise.all(
      boards.map(async (board) => {
        const items =
          await Promise.all(
            board.board_items.map(
              async (item) => {
                const {
                  data:
                    signedUrlData,
                  error:
                    signedUrlError,
                } =
                  await supabase.storage
                    .from(
                      'clothing-images'
                    )
                    .createSignedUrl(
                      item.image_path_snapshot,
                      60 * 60
                    );

                if (
                  signedUrlError
                ) {
                  console.error(
                    signedUrlError.message
                  );
                }

                return {
                  id: item.id,

                  position:
                    item.position,

                  clothingItemId:
                    item.clothing_item_id,

                  name:
                    item.name_snapshot,

                  category:
                    item.category_snapshot,

                  imagePath:
                    item.image_path_snapshot,

                  image:
                    signedUrlData?.signedUrl ??
                    '',
                };
              }
            )
          );

        items.sort(
          (a, b) =>
            a.position -
            b.position
        );

        return {
          id: board.id,
          name: board.name,
          isPublic:
            board.is_public,
          createdAt:
            board.created_at,
          items,
        };
      })
    );

  return NextResponse.json(
    savedBoards
  );
}