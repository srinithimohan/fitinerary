'use client';

import { useState } from 'react';

import type { ClothingItem } from '@/app/lib/definitions';

type ChooseFromClosetModalProps = {
  clothes: ClothingItem[];
  categories: string[];
  onSelect: (item: ClothingItem) => void;
  onClose: () => void;
};

export default function ChooseFromClosetModal({
  clothes,
  categories,
  onSelect,
  onClose,
}: ChooseFromClosetModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const visibleClothes = clothes.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' ||
      item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Choose from Closet
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-black"
          >
            Close
          </button>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
          placeholder="Search your closet..."
          className="mb-5 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setSelectedCategory(category)
              }
              className={`rounded-full px-4 py-2 text-sm ${
                selectedCategory === category
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {visibleClothes.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center">
            <p className="text-gray-500">
              No clothing found.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {visibleClothes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="overflow-hidden rounded-xl border border-gray-200 text-left transition hover:border-black"
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="p-3">
                  <p className="truncate font-medium">
                    {item.name}
                  </p>

                  <p className="text-sm text-gray-500">
                    {item.category}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}