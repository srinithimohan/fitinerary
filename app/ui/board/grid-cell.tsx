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

    type: 'board-cell',
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
        bg-white
        transition
        rounded-xl
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

          <button
            type="button"
            onClick={handleChooseImage}
            className="absolute bottom-2 right-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-black shadow hover:bg-white"
          >
            Upload
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleChooseImage}
          className="flex h-full w-full items-center rounded-md justify-center text-sm text-gray-500 hover:bg-gray-50"
        >
          + add photo
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