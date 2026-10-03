'use client';

import { useState } from 'react';
import AddClothingButton from './add-clothing-button';
import ClothingCard from './clothing-card';

type ClothingItem = {
  id: string;
  image: string;
  name: string;
};

export default function Closet() {
  const [clothes, setClothes] = useState<ClothingItem[]>([]);

  function handleAddClothing(file: File) {
    const newItem: ClothingItem = {
      id: crypto.randomUUID(),
      image: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, ''),
    };

    setClothes((currentClothes) => [...currentClothes, newItem]);
  }

  function handleDeleteClothing(id: string) {
    const item = clothes.find((clothing) => clothing.id === id);

    if (item) {
      URL.revokeObjectURL(item.image);
    }

    setClothes((currentClothes) =>
      currentClothes.filter((clothing) => clothing.id !== id)
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Closet</h1>

        <AddClothingButton onAdd={handleAddClothing} />
      </div>

      {clothes.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">
            Your closet is empty. Add your first clothing item!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {clothes.map((item) => (
            <ClothingCard
              key={item.id}
              id={item.id}
              image={item.image}
              name={item.name}
              onDelete={handleDeleteClothing}
            />
          ))}
        </div>
      )}
    </main>
  );
}