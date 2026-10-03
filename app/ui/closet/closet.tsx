'use client';

import { useState } from 'react';

import type { ClothingItem } from '@/app/lib/definitions';

import AddClothingButton from './add-clothing-button';
import AddClothingModal from './add-clothing-modal';
import ClothingCard from './clothing-card';
import EditClothingModal from './edit-clothing-modal';

export default function Closet() {
  const [clothes, setClothes] = useState<ClothingItem[]>(
    []
  );

  const [categories, setCategories] = useState<string[]>(
    [
      'All',
      'Tops',
      'Bottoms',
      'Layers',
      'Shoes',
    ]
  );

  const [pendingImage, setPendingImage] = useState<
    string | null
  >(null);

  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const [searchTerm, setSearchTerm] = useState('');

  const [editingItem, setEditingItem] =
    useState<ClothingItem | null>(null);

  function handleChooseImage(file: File) {
    const imageUrl = URL.createObjectURL(file);

    setPendingImage(imageUrl);
  }

  function handleSaveClothing(
    name: string,
    category: string
  ) {
    if (!pendingImage) {
      return;
    }

    const existingCategory = categories.find(
      (existing) =>
        existing.toLowerCase() ===
        category.toLowerCase()
    );

    const finalCategory =
      existingCategory ?? category;

    const newItem: ClothingItem = {
      id: crypto.randomUUID(),
      image: pendingImage,
      name,
      category: finalCategory,
    };

    setClothes((currentClothes) => [
      ...currentClothes,
      newItem,
    ]);

    if (!existingCategory) {
      setCategories((currentCategories) => [
        ...currentCategories,
        category,
      ]);
    }

    setPendingImage(null);
  }

  function handleCancelAdd() {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage);
    }

    setPendingImage(null);
  }

  function handleEditClothing(item: ClothingItem) {
    setEditingItem(item);
  }

  function handleSaveEdit(
    id: string,
    name: string,
    category: string
  ) {
    setClothes((currentClothes) =>
      currentClothes.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              category,
            }
          : item
      )
    );

    setEditingItem(null);
  }

  function handleDeleteClothing(id: string) {
    const item = clothes.find(
      (clothing) => clothing.id === id
    );

    if (item) {
      URL.revokeObjectURL(item.image);
    }

    setClothes((currentClothes) =>
      currentClothes.filter(
        (clothing) => clothing.id !== id
      )
    );
  }

  function handleDeleteCategory(
    categoryToDelete: string
  ) {
    if (categoryToDelete === 'All') {
      return;
    }

    // Move all clothing in this category back to All.
    setClothes((currentClothes) =>
      currentClothes.map((item) =>
        item.category === categoryToDelete
          ? {
              ...item,
              category: 'All',
            }
          : item
      )
    );

    // Remove the category.
    setCategories((currentCategories) =>
      currentCategories.filter(
        (category) =>
          category !== categoryToDelete
      )
    );

    // Return to the All tab.
    setSelectedCategory('All');
  }

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          My Closet
        </h1>

        <AddClothingButton
          onAdd={handleChooseImage}
        />
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(event.target.value)
        }
        placeholder="Search your closet..."
        className="mb-5 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
      />

      {/* Categories */}
      <div className="mb-8 flex flex-wrap gap-2">
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

      {/* Selected category header */}
      {selectedCategory !== 'All' && (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {selectedCategory}
          </h2>

          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm(
                `Delete "${selectedCategory}"? Clothing in this category will be moved to All.`
              );

              if (confirmed) {
                handleDeleteCategory(
                  selectedCategory
                );
              }
            }}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Delete Category
          </button>
        </div>
      )}

      {/* Closet cards */}
      {visibleClothes.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">
            No clothing found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {visibleClothes.map((item) => (
            <ClothingCard
              key={item.id}
              item={item}
              onDelete={
                handleDeleteClothing
              }
              onEdit={handleEditClothing}
            />
          ))}
        </div>
      )}

      {/* Add clothing modal */}
      {pendingImage && (
        <AddClothingModal
          image={pendingImage}
          categories={categories}
          onClose={handleCancelAdd}
          onSave={handleSaveClothing}
        />
      )}

      {/* Edit clothing modal */}
      {editingItem && (
        <EditClothingModal
          item={editingItem}
          categories={categories}
          onClose={() =>
            setEditingItem(null)
          }
          onSave={handleSaveEdit}
        />
      )}
    </main>
  );
}