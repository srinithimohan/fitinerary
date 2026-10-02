'use client';

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
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
  });

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
        border-b
        border-r
        border-black
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <label className="flex h-full w-full cursor-pointer items-center justify-center">
        {image ? (
          <img
            src={image}
            alt={`Clothing item ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg text-gray-500">
            Upload
          </span>
        )}

        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) =>
            onImageUpload(event, id)
          }
        />
      </label>

      <button
        ref={handleRef}
        type="button"
        className="
          absolute
          right-2
          top-2
          z-10
          cursor-grab
          rounded
          bg-white
          px-2
          py-1
          text-sm
          shadow
          active:cursor-grabbing
        "
        aria-label="Move clothing item"
      >
        ⋮⋮
      </button>
    </div>
  );
}