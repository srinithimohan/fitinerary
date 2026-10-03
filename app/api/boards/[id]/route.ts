import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/app/lib/supabase';

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  const { id } = await params;

  const supabase =
    createServerSupabaseClient();

  /*
   * Find all of the snapshot images
   * belonging to this board.
   */
  const {
    data: boardItems,
    error: boardItemsError,
  } = await supabase
    .from('board_items')
    .select('image_path_snapshot')
    .eq('board_id', id);

  if (boardItemsError) {
    return NextResponse.json(
      {
        error: `Could not find board items: ${boardItemsError.message}`,
      },
      { status: 500 }
    );
  }

  /*
   * Delete the saved snapshot images
   * from Supabase Storage.
   */
  const imagePaths = boardItems.map(
    (item) =>
      item.image_path_snapshot
  );

  if (imagePaths.length > 0) {
    const { error: storageError } =
      await supabase.storage
        .from('clothing-images')
        .remove(imagePaths);

    if (storageError) {
      return NextResponse.json(
        {
          error: `Could not delete board images: ${storageError.message}`,
        },
        { status: 500 }
      );
    }
  }

  /*
   * Delete the board.
   *
   * Because board_items has
   * ON DELETE CASCADE, PostgreSQL
   * automatically deletes its
   * board_items too.
   */
  const {
    data: deletedBoard,
    error: deleteError,
  } = await supabase
    .from('boards')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  if (deleteError || !deletedBoard) {
    return NextResponse.json(
      {
        error:
          deleteError?.message ??
          'Could not delete board.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}