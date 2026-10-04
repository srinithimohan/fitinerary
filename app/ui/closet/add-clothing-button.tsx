'use client';

import { useRef } from 'react';

type AddClothingButtonProps = {
  onAdd: (file: File) => void;
};

export default function AddClothingButton({
  onAdd,
}: AddClothingButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onAdd(file);

    // Allows the same file to be selected again later.
    event.target.value = '';
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
      >
        + add clothing
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}