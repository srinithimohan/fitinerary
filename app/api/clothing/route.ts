import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/app/lib/supabase';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('clothing_items')
    .select('id, name, category, image_path')
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const clothes = await Promise.all(
    data.map(async (item) => {
      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await supabase.storage
        .from('clothing-images')
        .createSignedUrl(
          item.image_path,
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
        name: item.name,
        category: item.category,
        imagePath: item.image_path,
        image: signedUrlData?.signedUrl ?? '',
      };
    })
  );

  return NextResponse.json(clothes);
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();

    const file = formData.get('file');
    const name = formData.get('name');
    const category = formData.get('category');

    if (
      !(file instanceof File) ||
      typeof name !== 'string' ||
      typeof category !== 'string'
    ) {
      return NextResponse.json(
        {
          error: 'Missing clothing information.',
        },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName || !trimmedCategory) {
      return NextResponse.json(
        {
          error: 'Name and category are required.',
        },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          error: 'The uploaded file must be an image.',
        },
        { status: 400 }
      );
    }

    const supabase =
      createServerSupabaseClient();

    const extension =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase() ?? 'jpg';

    const imagePath =
      `${userId}/${crypto.randomUUID()}.${extension}`;

    // Upload image to Storage.
    const { error: uploadError } =
      await supabase.storage
        .from('clothing-images')
        .upload(imagePath, file, {
          contentType: file.type,
          upsert: false,
        });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Storage upload failed: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    // Save clothing row.
    const {
      data: clothing,
      error: insertError,
    } = await supabase
      .from('clothing_items')
      .insert({
        name: trimmedName,
        category: trimmedCategory,
        image_path: imagePath,
      })
      .select(
        'id, name, category, image_path'
      )
      .single();

    if (insertError) {
      await supabase.storage
        .from('clothing-images')
        .remove([imagePath]);

      return NextResponse.json(
        {
          error: `Database insert failed: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    // Generate signed image URL.
    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from('clothing-images')
      .createSignedUrl(
        imagePath,
        60 * 60
      );

    if (signedUrlError) {
      return NextResponse.json(
        {
          error: `Signed URL failed: ${signedUrlError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: clothing.id,
        name: clothing.name,
        category: clothing.category,
        imagePath: clothing.image_path,
        image: signedUrlData.signedUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown server error';

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const { id, name, category } = body;

    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      typeof category !== 'string'
    ) {
      return NextResponse.json(
        {
          error: 'Invalid clothing information.',
        },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName || !trimmedCategory) {
      return NextResponse.json(
        {
          error: 'Name and category are required.',
        },
        { status: 400 }
      );
    }

    const supabase =
      createServerSupabaseClient();

    const {
      data: clothing,
      error: updateError,
    } = await supabase
      .from('clothing_items')
      .update({
        name: trimmedName,
        category: trimmedCategory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, name, category, image_path'
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: `Could not update clothing: ${updateError.message}`,
        },
        { status: 500 }
      );
    }

    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from('clothing-images')
      .createSignedUrl(
        clothing.image_path,
        60 * 60
      );

    if (signedUrlError) {
      return NextResponse.json(
        {
          error: `Could not load image: ${signedUrlError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: clothing.id,
      name: clothing.name,
      category: clothing.category,
      imagePath: clothing.image_path,
      image: signedUrlData.signedUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown server error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);

  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      {
        error: 'Clothing ID is required.',
      },
      { status: 400 }
    );
  }

  const supabase =
    createServerSupabaseClient();

  // First find the image belonging to this item.
  const {
    data: clothing,
    error: findError,
  } = await supabase
    .from('clothing_items')
    .select('id, image_path')
    .eq('id', id)
    .single();

  if (findError || !clothing) {
    return NextResponse.json(
      {
        error: 'Clothing item not found.',
      },
      { status: 404 }
    );
  }

  // Delete the database row.
  const { error: deleteError } =
    await supabase
      .from('clothing_items')
      .delete()
      .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `Could not delete clothing: ${deleteError.message}`,
      },
      { status: 500 }
    );
  }

  // Delete the actual image file too.
  const { error: storageError } =
    await supabase.storage
      .from('clothing-images')
      .remove([clothing.image_path]);

  if (storageError) {
    console.error(
      'Could not remove clothing image:',
      storageError.message
    );
  }

  return NextResponse.json({
    success: true,
  });
}