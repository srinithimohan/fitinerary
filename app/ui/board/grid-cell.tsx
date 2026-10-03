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
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
  });

  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        rounded-lg
        border
        border-black
        bg-white
      `}
    >
      {image ? (
        <>
          <img
            src={image}
            alt={`Clothing item ${index + 1}`}
            className="h-full w-full object-cover"
          />

          {/* Replace image button */}
          <button
            type="button"
            onClick={handleChooseImage}
            className="
              absolute
              bottom-2
              left-1/2
              -translate-x-1/2
              rounded
              bg-white
              px-3
              py-1
              text-sm
              shadow
            "
          >
            Replace Photo
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleChooseImage}
          className="
            flex
            h-full
            w-full
            items-center
            justify-center
            text-lg
            text-gray-500
          "
        >
          Add Image
        </button>
      )}

      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onImageUpload(event, id)}
      />

      {/* Drag handle */}
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
      </button>
    </div>
  );
}