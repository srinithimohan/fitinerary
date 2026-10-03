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

  /*
   * CLICK FROM CLOSET
   *
   * Clicking an item fills the next available
   * empty board cell.
   */
  function handleAddFromCloset(
    item: ClothingItem
  ) {
    setCells((currentCells) => {
      const alreadyOnBoard =
        currentCells.some(
          (cell) =>
            cell.clothingItemId === item.id
        );

      if (alreadyOnBoard) {
        return currentCells;
      }

      const firstEmptyIndex =
        currentCells.findIndex(
          (cell) => cell.image === null
        );

      // Board is full.
      if (firstEmptyIndex === -1) {
        return currentCells;
      }

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

  /*
   * DIRECT IMAGE UPLOAD
   *
   * This lets the user upload or replace
   * an image directly in a board cell.
   */
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

              // Direct upload does not reference
              // an existing Closet item.
              clothingItemId: null,
            }
          : cell
      )
    );

    // Allows the same file to be selected again.
    event.target.value = '';
  }

  /*
   * DRAG END
   *
   * There are now two possible kinds of drag:
   *
   * closet item -> board cell
   * board cell  -> board cell
   */
  function handleDragEnd(event: any) {
    if (event.canceled) {
      return;
    }

    const { source, target } =
      event.operation;

    if (!source) {
      return;
    }

    /*
     * CASE 1:
     * CLOSET ITEM -> BOARD CELL
     *
     * Put the closet item directly into
     * whichever cell it was dropped onto.
     */
    if (source.type === 'closet-item') {
      if (!target) {
        return;
      }

      const targetCellExists = cells.some(
        (cell) => cell.id === target.id
      );

      if (!targetCellExists) {
        return;
      }

      const sourceId = String(source.id);

      const prefix = 'closet-item:';

      if (!sourceId.startsWith(prefix)) {
        return;
      }

      const clothingItemId =
        sourceId.slice(prefix.length);

      const closetItem = clothes.find(
        (item) =>
          item.id === clothingItemId
      );

      if (!closetItem) {
        return;
      }

      setCells((currentCells) =>
        currentCells.map((cell) =>
          cell.id === target.id
            ? {
                ...cell,
                image: closetItem.image,
                clothingItemId:
                  closetItem.id,
              }
            : cell
        )
      );

      return;
    }

    /*
     * CASE 2:
     * BOARD CELL -> BOARD CELL
     *
     * Keep your existing sortable behavior.
     */
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
  }

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
    >
      {/* Fixed Closet panel */}
      {showCloset && (
        <div className="fixed left-4 top-1/2 z-40 max-h-[calc(100vh-4rem)] -translate-y-1/2 overflow-hidden">
          <ClosetPicker
            clothes={clothes}
            categories={categories}
            onSelect={handleAddFromCloset}
          />
        </div>
      )}

      {/* Board stays centered */}
      <div className="flex flex-col items-center gap-4">

        {/* Board */}
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

        {/* Add from Closet button */}
        <button
          type="button"
          onClick={() =>
            setShowCloset(
              (current) => !current
            )
          }
          className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          {showCloset
            ? 'Close Closet'
            : 'Add from Closet'}
        </button>

      </div>
    </DragDropProvider>
  );
}