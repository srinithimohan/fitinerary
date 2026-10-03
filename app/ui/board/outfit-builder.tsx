'use client';

import { useState } from 'react';

import OutfitGrid from './outfit-grid';
import BoardActions from './board-actions';

export type GridCell = {
  id: string;
  image: string | null;
  clothingItemId: string | null;
};

function createInitialCells(): GridCell[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `cell-${index}`,
    image: null,
    clothingItemId: null,
  }));
}

export default function OutfitBuilder() {
  const [cells, setCells] = useState<GridCell[]>(
    createInitialCells()
  );

  function handleClear() {
    setCells(createInitialCells());
  }

  function handleSave() {
    console.log('Saving board:', cells);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <OutfitGrid
        cells={cells}
        setCells={setCells}
      />

      <BoardActions
        onClear={handleClear}
        onSave={handleSave}
      />
    </div>
  );
}