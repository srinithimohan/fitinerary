'use client';

import { useState } from 'react';
import type { ClothingItem } from '@/app/lib/definitions';

type EditClothingModalProps = {
  item: ClothingItem;
  categories: string[];
  onClose: () => void;
  onSave: (
    id: string,
    name: string,
    category: string
  ) => void;
};

export default function EditClothingModal({
  item,
  categories,
  onClose,
  onSave,
}: EditClothingModalProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(
    item.category
  );

const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (
  event
) => {
  event.preventDefault();

  const finalName = name.trim();

  if (!finalName) {
    return;
  }

  onSave(item.id, finalName, category);
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Image */}
          <div className="flex items-center justify-center">
            <div className="aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-gray-100">
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col justify-center"
          >
            <h2 className="mb-6 text-2xl font-bold">
              edit clothing
            </h2>

            {/* Name */}
            <label className="mb-2 font-medium">
              name
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="mb-5 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
            />

            {/* Category */}
            <label className="mb-2 font-medium">
              category
            </label>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              {categories.map((categoryOption) => (
                <option
                  key={categoryOption}
                  value={categoryOption}
                >
                  {categoryOption}
                </option>
              ))}
            </select>

            {/* buttons */}
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
                cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-black px-4 py-2 text-white"
              >
                save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}