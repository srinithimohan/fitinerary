'use client';

import { useState } from 'react';

import type { ClothingItem } from '@/app/lib/definitions';
import { useCloset } from '@/app/context/closet-context';

import AddClothingButton from './add-clothing-button';
import AddClothingModal from './add-clothing-modal';
import ClothingCard from './clothing-card';
import EditClothingModal from './edit-clothing-modal';

import { orbitron } from '../fonts';

export default function Closet() {
  const {
    clothes,
    setClothes,
    categories,
    setCategories,
    isLoading,
  } = useCloset();

  const [
    pendingImage,
    setPendingImage,
  ] = useState<string | null>(null);

  const [
    pendingFile,
    setPendingFile,
  ] = useState<File | null>(null);

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('All');

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    editingItem,
    setEditingItem,
  ] = useState<ClothingItem | null>(
    null
  );

  const [saveError, setSaveError] =
    useState<string | null>(null);

  function handleChooseImage(file: File) {
    if (pendingImage) {
      URL.revokeObjectURL(
        pendingImage
      );
    }

    const imageUrl =
      URL.createObjectURL(file);

    setPendingFile(file);
    setPendingImage(imageUrl);
    setSaveError(null);
  }

  async function handleSaveClothing(
    name: string,
    category: string
  ) {
    if (!pendingFile) {
      return;
    }

    setSaveError(null);

    const existingCategory =
      categories.find(
        (existing) =>
          existing.toLowerCase() ===
          category.toLowerCase()
      );

    const finalCategory =
      existingCategory ??
      category.trim();

    const formData =
      new FormData();

    formData.append(
      'file',
      pendingFile
    );

    formData.append(
      'name',
      name
    );

    formData.append(
      'category',
      finalCategory
    );

    try {
      const response = await fetch(
        '/api/clothing',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setSaveError(
          typeof data.error ===
          'string'
            ? data.error
            : 'could not save clothing.'
        );

        return;
      }

      const newItem =
        data as ClothingItem;

      setClothes(
        (currentClothes) => [
          newItem,
          ...currentClothes,
        ]
      );

      if (!existingCategory) {
        setCategories(
          (currentCategories) => [
            ...currentCategories,
            finalCategory,
          ]
        );
      }

      if (pendingImage) {
        URL.revokeObjectURL(
          pendingImage
        );
      }

      setPendingFile(null);
      setPendingImage(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not save clothing.';

      setSaveError(message);
    }
  }

  function handleCancelAdd() {
    if (pendingImage) {
      URL.revokeObjectURL(
        pendingImage
      );
    }

    setPendingFile(null);
    setPendingImage(null);
    setSaveError(null);
  }

  function handleEditClothing(
    item: ClothingItem
  ) {
    setEditingItem(item);
    setSaveError(null);
  }

  async function handleSaveEdit(
    id: string,
    name: string,
    category: string
  ) {
    setSaveError(null);

    const existingCategory =
      categories.find(
        (existing) =>
          existing.toLowerCase() ===
          category.toLowerCase()
      );

    const finalCategory =
      existingCategory ??
      category.trim();

    try {
      const response = await fetch(
        '/api/clothing',
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            id,
            name,
            category: finalCategory,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setSaveError(
          typeof data.error ===
          'string'
            ? data.error
            : 'Could not update clothing.'
        );

        return;
      }

      const updatedItem =
        data as ClothingItem;

      setClothes(
        (currentClothes) =>
          currentClothes.map(
            (item) =>
              item.id === id
                ? updatedItem
                : item
          )
      );

      if (!existingCategory) {
        setCategories(
          (currentCategories) => [
            ...currentCategories,
            finalCategory,
          ]
        );
      }

      setEditingItem(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not update clothing.';

      setSaveError(message);
    }
  }

  async function handleDeleteClothing(
    id: string
  ) {
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/clothing?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setSaveError(
          typeof data.error ===
          'string'
            ? data.error
            : 'Could not delete clothing.'
        );

        return;
      }

      setClothes(
        (currentClothes) =>
          currentClothes.filter(
            (item) =>
              item.id !== id
          )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not delete clothing.';

      setSaveError(message);
    }
  }

  async function handleDeleteCategory(
    categoryToDelete: string
  ) {
    if (
      categoryToDelete === 'All'
    ) {
      return;
    }

    setSaveError(null);

    const affectedItems =
      clothes.filter(
        (item) =>
          item.category ===
          categoryToDelete
      );

    try {
      const updatedItems =
        await Promise.all(
          affectedItems.map(
            async (item) => {
              const response =
                await fetch(
                  '/api/clothing',
                  {
                    method: 'PATCH',

                    headers: {
                      'Content-Type':
                        'application/json',
                    },

                    body: JSON.stringify({
                      id: item.id,
                      name: item.name,
                      category: 'All',
                    }),
                  }
                );

              const data =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  typeof data.error ===
                  'string'
                    ? data.error
                    : 'Could not update clothing.'
                );
              }

              return data as ClothingItem;
            }
          )
        );

      setClothes(
        (currentClothes) =>
          currentClothes.map(
            (item) => {
              const updatedItem =
                updatedItems.find(
                  (updated) =>
                    updated.id ===
                    item.id
                );

              return (
                updatedItem ?? item
              );
            }
          )
      );

      setCategories(
        (currentCategories) =>
          currentCategories.filter(
            (category) =>
              category !==
              categoryToDelete
          )
      );

      setSelectedCategory('All');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'could not delete category.';

      setSaveError(message);
    }
  }

  const visibleClothes =
    clothes.filter((item) => {
      const matchesSearch =
        item.name
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesCategory =
        selectedCategory ===
          'All' ||
        item.category ===
          selectedCategory;

      return (
        matchesSearch &&
        matchesCategory
      );
    });

  return (
    <main className="mx-auto max-w-6xl py-10 pl-6 pr-36">
      <div className="mb-8 flex items-center justify-between">
        <h1 className={`${orbitron.className} text-3xl text-[#4D5382] font-bold`}>
          closet
        </h1>

        <AddClothingButton
          onAdd={
            handleChooseImage
          }
        />
      </div>

      {saveError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(
            event.target.value
          )
        }
        placeholder="search your closet..."
        className="mb-5 w-full rounded-lg border border-[#4D5382] px-4 py-3 outline-none focus:border-black"
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map(
          (category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setSelectedCategory(
                  category
                )
              }
              className={`rounded-full px-4 py-2 text-sm ${
                selectedCategory ===
                category
                  ? 'bg-[#98CE00] text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {category}
            </button>
          )
        )}
      </div>

      {selectedCategory !==
        'All' && (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {selectedCategory}
          </h2>

          <button
            type="button"
            onClick={() => {
              const confirmed =
                window.confirm(
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
            deleteCategory
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <p className="text-gray-500">
            loading closet...
          </p>
        </div>
      ) : visibleClothes.length ===
        0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[#4D5382]">
          <p className="text-gray-500">
            no clothing found
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {visibleClothes.map(
            (item) => (
              <ClothingCard
                key={item.id}
                item={item}
                onDelete={
                  handleDeleteClothing
                }
                onEdit={
                  handleEditClothing
                }
              />
            )
          )}
        </div>
      )}

      {pendingImage && (
        <AddClothingModal
          image={pendingImage}
          categories={categories}
          onClose={
            handleCancelAdd
          }
          onSave={
            handleSaveClothing
          }
        />
      )}

      {editingItem && (
        <EditClothingModal
          item={editingItem}
          categories={categories}
          onClose={() =>
            setEditingItem(null)
          }
          onSave={
            handleSaveEdit
          }
        />
      )}
    </main>
  );
}