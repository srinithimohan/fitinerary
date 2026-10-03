'use client';

import { useState } from 'react';

import type { ClothingItem } from '@/app/lib/definitions';

type ClosetPickerProps = {
  clothes: ClothingItem[];
  categories: string[];
  onSelect: (item: ClothingItem) => void;
};

export default function ClosetPicker({
  clothes,
  categories,
  onSelect,
}: ClosetPickerProps) {
  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const [searchTerm, setSearchTerm] = useState('');

  const visibleClothes = clothes.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      item.category === selectedCategory;

    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">
        Your Closet
      </h2>

      {/* Search */}
      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(event.target.value)
        }
        placeholder="Search your closet..."
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
      />

      {/* Categories */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() =>
              setSelectedCategory(category)
            }
            className={`rounded-full px-3 py-1 text-xs ${
              selectedCategory === category
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Clothing */}
      {visibleClothes.length === 0 ? (
        <p className="text-sm text-gray-500">
          No clothing found.
        </p>
      ) : (
        <div className="grid max-h-[500px] grid-cols-2 gap-3 overflow-y-auto">
          {visibleClothes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left hover:border-black"
            >
              <div className="aspect-square overflow-hidden bg-gray-100">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-2">
                <p className="truncate text-sm font-medium">
                  {item.name}
                </p>

                <p className="truncate text-xs text-gray-500">
                  {item.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}