'use client';

import type { ClothingItem } from '@/app/lib/definitions';

type ClothingCardProps = {
  item: ClothingItem;
  onDelete: (id: string) => void;
  onEdit: (item: ClothingItem) => void;
};

export default function ClothingCard({
  item,
  onDelete,
  onEdit,
}: ClothingCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Information */}
      <div className="p-3">
        <div className="mb-3">
          <p className="truncate font-medium">
            {item.name}
          </p>

          <p className="text-sm text-gray-500">
            {item.category}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="text-sm font-medium text-gray-600 hover:text-black"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}