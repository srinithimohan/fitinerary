'use client';

import { useState } from 'react';

type AddClothingModalProps = {
  image: string;
  categories: string[];
  onClose: () => void;
  onSave: (name: string, category: string) => void;
};

export default function AddClothingModal({
  image,
  categories,
  onClose,
  onSave,
}: AddClothingModalProps) {
  const [name, setName] = useState('');

  const [selectedCategory, setSelectedCategory] = useState(
    categories[0] ?? 'All'
  );

  const [creatingCategory, setCreatingCategory] = useState(false);

  const [newCategory, setNewCategory] = useState('');

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const finalName = name.trim();

    const finalCategory = creatingCategory
      ? newCategory.trim()
      : selectedCategory;

    if (!finalName || !finalCategory) {
      return;
    }

    onSave(finalName, finalCategory);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Image preview */}
          <div className="flex items-center justify-center">
            <div className="aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-gray-100">
              <img
                src={image}
                alt="Clothing preview"
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
              Add Clothing
            </h2>

            {/* Name */}
            <label className="mb-2 font-medium">
              Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="White linen shirt"
              className="mb-5 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
            />

            {/* Category */}
            <label className="mb-2 font-medium">
              Category
            </label>

            {!creatingCategory ? (
              <>
                <select
                  value={selectedCategory}
                  onChange={(event) =>
                    setSelectedCategory(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2"
                >
                  {categories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setCreatingCategory(true)
                  }
                  className="mt-3 self-start text-sm font-medium underline"
                >
                  + Create new category
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value)
                  }
                  placeholder="Example: Dresses"
                  className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
                />

                <button
                  type="button"
                  onClick={() => {
                    setCreatingCategory(false);
                    setNewCategory('');
                  }}
                  className="mt-3 self-start text-sm font-medium underline"
                >
                  Choose existing category instead
                </button>
              </>
            )}

            {/* Buttons */}
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#5EFC8D] px-4 py-2"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-[#5EFC8D] px-4 py-2 text-white"
              >
                Add to Closet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}