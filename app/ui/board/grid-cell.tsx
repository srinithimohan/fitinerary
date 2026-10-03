'use client';

import { useRef } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

type SortableGridCellProps = {
  id: string;
  index: number;
  image: string | null;

  onImageUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
    id: string
  ) => void;
};

export default function SortableGridCell({
  id,
  index,
  image,
  onImageUpload,
}: SortableGridCellProps) {
  const {
    ref,
    isDragging,
    isDropTarget,
  } = useSortable({
    id,
    index,

    // This item itself is a board cell.
    type: 'board-cell',

    // Board cells accept:
    // 1. other board cells for reordering
    // 2. closet items for adding/replacing images
    accept: ['board-cell', 'closet-item'],
  });

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  function handleChooseImage() {
    fileInputRef.current?.click();
  }

  return (
    <div
      ref={ref}
      className={`
        relative
        flex
        aspect-square
        items-center
        justify-center
        overflow-hidden
        border
        border-black
        bg-white
        transition
        ${isDragging ? 'opacity-50' : ''}
        ${
          isDropTarget
            ? 'ring-4 ring-black/30'
            : ''
        }
      `}
    >
      {image ? (
        <>
          <img
            src={image}
            alt="Outfit item"
            className="h-full w-full object-cover"
          />

          {/* Replace using upload */}
          <button
            type="button"
            onClick={handleChooseImage}
            className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-black shadow hover:bg-white"
          >
            Upload
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleChooseImage}
          className="flex h-full w-full items-center justify-center text-sm text-gray-500 hover:bg-gray-50"
        >
          + Add Photo
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(event) =>
          onImageUpload(event, id)
        }
        className="hidden"
      />
    </div>
  );
}