import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/app/lib/supabase';

type IncomingBoardItem = {
  position: number;
  clothingItemId: string | null;
  hasUpload: boolean;
};

export async function POST(
  request: Request
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

  const supabase =
    createServerSupabaseClient();

  let boardId: string | null =
    null;

  const uploadedPaths: string[] =
    [];


  async function cleanup() {
    if (
      uploadedPaths.length > 0
    ) {
      await supabase.storage
        .from('clothing-images')
        .remove(uploadedPaths);
    }

    if (boardId) {
      await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);
    }
  }

  try {
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

    const positions =
      new Set<number>();

    for (const item of items) {
      if (
        !Number.isInteger(
          item.position
        ) ||
        item.position < 0 ||
        item.position > 8
      ) {
        return NextResponse.json(
          {
            error:
              'Board contains an invalid position.',
          },
          { status: 400 }
        );
      }

      if (
        positions.has(
          item.position
        )
      ) {
        return NextResponse.json(
          {
            error:
              'Board contains duplicate positions.',
          },
          { status: 400 }
        );
      }

      positions.add(
        item.position
      );
    }

    const {
      data: board,
      error: boardError,
    } = await supabase
      .from('boards')
      .insert({
        name: boardName,
      })
      .select('id, name')
      .single();

    if (
      boardError ||
      !board
    ) {
      return NextResponse.json(
        {
          error:
            boardError?.message ??
            'Could not create board.',
        },
        { status: 500 }
      );
    }

    boardId = board.id;

    const boardItems = [];

    for (const item of items) {
      if (
        item.clothingItemId
      ) {
        const {
          data: clothing,
          error:
            clothingError,
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
          await cleanup();

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
          `${userId}/board-snapshots/${board.id}/${item.position}-${crypto.randomUUID()}.${extension}`;

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
          await cleanup();

          return NextResponse.json(
            {
              error: `Could not save board image: ${copyError.message}`,
            },
            { status: 500 }
          );
        }

        uploadedPaths.push(
          snapshotPath
        );

        boardItems.push({
          board_id: board.id,
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
          await cleanup();

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
          await cleanup();

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
          `${userId}/board-snapshots/${board.id}/${item.position}-${crypto.randomUUID()}.${extension}`;

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
          await cleanup();

          return NextResponse.json(
            {
              error: `Could not upload board image: ${uploadError.message}`,
            },
            { status: 500 }
          );
        }

        uploadedPaths.push(
          snapshotPath
        );

        boardItems.push({
          board_id: board.id,
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
      error:
        boardItemsError,
    } = await supabase
      .from('board_items')
      .insert(boardItems);

    if (boardItemsError) {
      await cleanup();

      return NextResponse.json(
        {
          error: `Could not save board items: ${boardItemsError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: board.id,
        name: board.name,
      },
      { status: 201 }
    );
  } catch (error) {
    await cleanup();

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown server error';

    return NextResponse.json(
      {
        error: `Could not save board: ${message}`,
      },
      { status: 500 }
    );
  }
}