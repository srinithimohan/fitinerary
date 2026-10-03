'use client';

import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';

import { useState } from 'react';

import { useCloset } from '@/app/context/closet-context';
import type { ClothingItem } from '@/app/lib/definitions';

import ClosetPicker from './closet-picker';
import SortableGridCell from './grid-cell';

import type { GridCell } from './outfit-builder';

type OutfitGridProps = {
  cells: GridCell[];
  setCells: React.Dispatch<
    React.SetStateAction<GridCell[]>
  >;
};

export default function OutfitGrid({
  cells,
  setCells,
}: OutfitGridProps) {
  const { clothes, categories } = useCloset();

  const [showCloset, setShowCloset] =
    useState(false);

  function handleAddFromCloset(
    item: ClothingItem
  ) {
    setCells((currentCells) => {
      // Don't add the same closet item twice.
      const alreadyOnBoard =
        currentCells.some(
          (cell) =>
            cell.clothingItemId === item.id
        );

      if (alreadyOnBoard) {
        return currentCells;
      }

      // Find the first grid square
      // that does not have an image.
      const firstEmptyIndex =
        currentCells.findIndex(
          (cell) => cell.image === null
        );

      // All 9 cells are full.
      if (firstEmptyIndex === -1) {
        return currentCells;
      }

      // Put the selected closet item
      // into the first empty cell.
      return currentCells.map(
        (cell, index) =>
          index === firstEmptyIndex
            ? {
                ...cell,
                image: item.image,
                clothingItemId: item.id,
              }
            : cell
      );
    });
  }

  function handleImageUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    id: string
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageUrl =
      URL.createObjectURL(file);

    setCells((currentCells) =>
      currentCells.map((cell) =>
        cell.id === id
          ? {
              ...cell,
              image: imageUrl,

              // This wasn't chosen from the Closet,
              // so it doesn't have a closet item ID.
              clothingItemId: null,
            }
          : cell
      )
    );
  }

  return (
  <>
    {/* Closet panel - floats on left side of screen */}
    {showCloset && (
      <div className="fixed left-4 top-1/2 z-40 max-h-[calc(100vh-4rem)] -translate-y-1/2 overflow-hidden">
        <ClosetPicker
          clothes={clothes}
          categories={categories}
          onSelect={handleAddFromCloset}
        />
      </div>
    )}

    {/* Board stays centered and does not move */}
    <div className="flex flex-col items-center gap-4">
      {/* Add from Closet button */}
      <button
        type="button"
        onClick={() =>
          setShowCloset((current) => !current)
        }
        className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
      >
        {showCloset
          ? 'Close Closet'
          : 'Add from Closet'}
      </button>

      {/* Drag-and-drop board */}
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) {
            return;
          }

          const { source } = event.operation;

          if (!isSortable(source)) {
            return;
          }

          const {
            initialIndex,
            index,
          } = source;

          if (initialIndex === index) {
            return;
          }

          setCells((currentCells) => {
            const newCells = [
              ...currentCells,
            ];

            const [movedCell] =
              newCells.splice(
                initialIndex,
                1
              );

            newCells.splice(
              index,
              0,
              movedCell
            );

            return newCells;
          });
        }}
      >
        <div className="grid w-[min(90vw,75vh)] max-w-[600px] grid-cols-3 gap-2">
          {cells.map(
            (cell, index) => (
              <SortableGridCell
                key={cell.id}
                id={cell.id}
                index={index}
                image={cell.image}
                onImageUpload={
                  handleImageUpload
                }
              />
            )
          )}
        </div>
      </DragDropProvider>
    </div>
  </>
);
}