import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/app/lib/supabase';

type IncomingBoardItem = {
  position: number;
  clothingItemId: string | null;
  hasUpload: boolean;
  snapshotPath: string | null;
};

export async function GET(
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
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await params;

  const supabase =
    createServerSupabaseClient();

  const {
    data: board,
    error: boardError,
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
    .eq('id', id)
    .single();

  if (boardError || !board) {
    return NextResponse.json(
      {
        error: 'Board not found.',
      },
      { status: 404 }
    );
  }

  const items =
    await Promise.all(
      board.board_items.map(
        async (item) => {
          const {
            data: signedUrlData,
            error: signedUrlError,
          } = await supabase.storage
            .from('clothing-images')
            .createSignedUrl(
              item.image_path_snapshot,
              60 * 60
            );

          if (signedUrlError) {
            console.error(
              'Could not create signed URL:',
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
      a.position - b.position
  );

  return NextResponse.json({
    id: board.id,
    name: board.name,
    isPublic: board.is_public,
    createdAt: board.created_at,
    items,
  });
}

/*
 * PATCH
 *
 * Update an existing saved board.
 */
export async function PATCH(
  request: Request,
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
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await params;

  const supabase =
    createServerSupabaseClient();

  const newlyCreatedPaths: string[] =
    [];

  async function cleanupNewFiles() {
    if (
      newlyCreatedPaths.length >
      0
    ) {
      await supabase.storage
        .from('clothing-images')
        .remove(
          newlyCreatedPaths
        );
    }
  }

  try {
    const {
      data: existingBoard,
      error: boardError,
    } = await supabase
      .from('boards')
      .select('id')
      .eq('id', id)
      .single();

    if (
      boardError ||
      !existingBoard
    ) {
      return NextResponse.json(
        {
          error:
            'Board not found.',
        },
        { status: 404 }
      );
    }

    const formData =
      await request.formData();

    const name =
      formData.get('name');

    const itemsRaw =
      formData.get('items');

    if (
      typeof name !== 'string' ||
      typeof itemsRaw !==
        'string'
    ) {
      return NextResponse.json(
        {
          error:
            'Board information is missing.',
        },
        { status: 400 }
      );
    }

    const boardName =
      name.trim() ||
      'Untitled Board';

    let items:
      IncomingBoardItem[];

    try {
      items =
        JSON.parse(itemsRaw);
    } catch {
      return NextResponse.json(
        {
          error:
            'Board items are invalid.',
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Add at least one item before saving.',
        },
        { status: 400 }
      );
    }

    const {
      data: oldItems,
      error: oldItemsError,
    } = await supabase
      .from('board_items')
      .select(
        'id, position, image_path_snapshot'
      )
      .eq('board_id', id);

    if (oldItemsError) {
      return NextResponse.json(
        {
          error:
            oldItemsError.message,
        },
        { status: 500 }
      );
    }

    const newBoardItems = [];

    for (const item of items) {
      if (item.snapshotPath) {
        if (
          !item.snapshotPath.startsWith(
            `${userId}/`
          )
        ) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error:
                'Invalid board image.',
            },
            { status: 400 }
          );
        }

        newBoardItems.push({
          board_id: id,

          position:
            item.position,

          clothing_item_id:
            item.clothingItemId,

          image_path_snapshot:
            item.snapshotPath,
        });

        continue;
      }

      if (
        item.clothingItemId
      ) {
        const {
          data: clothing,
          error: clothingError,
        } = await supabase
          .from(
            'clothing_items'
          )
          .select(
            'id, name, category, image_path'
          )
          .eq(
            'id',
            item.clothingItemId
          )
          .single();

        if (
          clothingError ||
          !clothing
        ) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error:
                'One of the clothing items could not be found.',
            },
            { status: 400 }
          );
        }

        const extension =
          clothing.image_path
            .split('.')
            .pop() ?? 'jpg';

        const snapshotPath =
          `${userId}/board-snapshots/${id}/${item.position}-${crypto.randomUUID()}.${extension}`;

        const {
          error: copyError,
        } = await supabase.storage
          .from(
            'clothing-images'
          )
          .copy(
            clothing.image_path,
            snapshotPath
          );

        if (copyError) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error: `Could not save board image: ${copyError.message}`,
            },
            { status: 500 }
          );
        }

        newlyCreatedPaths.push(
          snapshotPath
        );

        newBoardItems.push({
          board_id: id,

          position:
            item.position,

          clothing_item_id:
            clothing.id,

          image_path_snapshot:
            snapshotPath,

          name_snapshot:
            clothing.name,

          category_snapshot:
            clothing.category,
        });

        continue;
      }

      if (item.hasUpload) {
        const file =
          formData.get(
            `file-${item.position}`
          );

        if (
          !(file instanceof File)
        ) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error:
                'A board image is missing.',
            },
            { status: 400 }
          );
        }

        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error:
                'Board uploads must be images.',
            },
            { status: 400 }
          );
        }

        const extension =
          file.name
            .split('.')
            .pop()
            ?.toLowerCase() ??
          'jpg';

        const snapshotPath =
          `${userId}/board-snapshots/${id}/${item.position}-${crypto.randomUUID()}.${extension}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(
            'clothing-images'
          )
          .upload(
            snapshotPath,
            file,
            {
              contentType:
                file.type,

              upsert: false,
            }
          );

        if (uploadError) {
          await cleanupNewFiles();

          return NextResponse.json(
            {
              error: `Could not upload board image: ${uploadError.message}`,
            },
            { status: 500 }
          );
        }

        newlyCreatedPaths.push(
          snapshotPath
        );

        newBoardItems.push({
          board_id: id,

          position:
            item.position,

          clothing_item_id:
            null,

          image_path_snapshot:
            snapshotPath,

          name_snapshot: null,

          category_snapshot:
            null,
        });
      }
    }

    const {
      error: upsertError,
    } = await supabase
      .from('board_items')
      .upsert(
        newBoardItems,
        {
          onConflict:
            'board_id,position',
        }
      );

    if (upsertError) {
      await cleanupNewFiles();

      return NextResponse.json(
        {
          error: `Could not update board items: ${upsertError.message}`,
        },
        { status: 500 }
      );
    }

    const usedPositions =
      new Set(
        items.map(
          (item) =>
            item.position
        )
      );

    const rowsToDelete =
      oldItems.filter(
        (oldItem) =>
          !usedPositions.has(
            oldItem.position
          )
      );

    if (
      rowsToDelete.length > 0
    ) {
      const idsToDelete =
        rowsToDelete.map(
          (item) =>
            item.id
        );

      const {
        error: deleteRowsError,
      } = await supabase
        .from('board_items')
        .delete()
        .in(
          'id',
          idsToDelete
        );

      if (deleteRowsError) {
        return NextResponse.json(
          {
            error:
              deleteRowsError.message,
          },
          { status: 500 }
        );
      }
    }


    const {
      data: updatedBoard,
      error: boardUpdateError,
    } = await supabase
      .from('boards')
      .update({
        name: boardName,

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name')
      .single();

    if (
      boardUpdateError ||
      !updatedBoard
    ) {
      return NextResponse.json(
        {
          error:
            boardUpdateError?.message ??
            'Could not update board.',
        },
        { status: 500 }
      );
    }


    const pathsStillUsed =
      new Set(
        newBoardItems.map(
          (item) =>
            item.image_path_snapshot
        )
      );

    const oldPathsToDelete =
      oldItems
        .map(
          (item) =>
            item.image_path_snapshot
        )
        .filter(
          (path) =>
            !pathsStillUsed.has(
              path
            )
        );

    if (
      oldPathsToDelete.length > 0
    ) {
      await supabase.storage
        .from(
          'clothing-images'
        )
        .remove(
          oldPathsToDelete
        );
    }

    return NextResponse.json({
      id: updatedBoard.id,
      name: updatedBoard.name,
    });
  } catch (error) {
    await cleanupNewFiles();

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown server error';

    return NextResponse.json(
      {
        error: `Could not update board: ${message}`,
      },
      { status: 500 }
    );
  }
}

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
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await params;

  const supabase =
    createServerSupabaseClient();

  const {
    data: boardItems,
    error: boardItemsError,
  } = await supabase
    .from('board_items')
    .select(
      'image_path_snapshot'
    )
    .eq('board_id', id);

  if (boardItemsError) {
    return NextResponse.json(
      {
        error:
          boardItemsError.message,
      },
      { status: 500 }
    );
  }

  const imagePaths =
    boardItems.map(
      (item) =>
        item.image_path_snapshot
    );

  if (
    imagePaths.length > 0
  ) {
    const {
      error: storageError,
    } = await supabase.storage
      .from('clothing-images')
      .remove(imagePaths);

    if (storageError) {
      return NextResponse.json(
        {
          error:
            storageError.message,
        },
        { status: 500 }
      );
    }
  }


  const {
    data: deletedBoard,
    error: deleteError,
  } = await supabase
    .from('boards')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  if (
    deleteError ||
    !deletedBoard
  ) {
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