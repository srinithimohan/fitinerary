'use client';

import { useState } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';

import SortableGridCell from './grid-cell';

type GridCell = {
  id: string;
  image: string | null;
};

const initialCells: GridCell[] = Array.from(
  { length: 9 },
  (_, index) => ({
    id: `cell-${index}`,
    image: null,
  })
);

export default function OutfitGrid() {
  const [cells, setCells] = useState<GridCell[]>(initialCells);

  function handleImageUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    id: string
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    setCells((currentCells) =>
      currentCells.map((cell) =>
        cell.id === id
          ? { ...cell, image: imageUrl }
          : cell
      )
    );
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;

        const { source } = event.operation;

        if (!isSortable(source)) return;

        const { initialIndex, index } = source;

        if (initialIndex === index) return;

        setCells((currentCells) => {
          const newCells = [...currentCells];

          const [movedCell] = newCells.splice(initialIndex, 1);

          newCells.splice(index, 0, movedCell);

          return newCells;
        });
      }}
    >
      <div className="mt-8 grid w-[600px] grid-cols-3 border-l border-t border-black">
        {cells.map((cell, index) => (
          <SortableGridCell
            key={cell.id}
            id={cell.id}
            index={index}
            image={cell.image}
            onImageUpload={handleImageUpload}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}