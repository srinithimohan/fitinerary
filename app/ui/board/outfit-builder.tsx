'use client';

import { useState } from 'react';

import OutfitGrid from './outfit-grid';
import BoardActions from './board-actions';

export type GridCell = {
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

export default function OutfitBuilder() {
  const [cells, setCells] = useState<GridCell[]>(initialCells);

  function handleClearBoard() {
    setCells(initialCells);
  }

  function handleSaveBoard() {
    console.log('Saving board:', cells);

    // Later:
    // call a Server Action here
    // and save the board to PostgreSQL
  }

  return (
    <section className="flex flex-col items-center">
      <OutfitGrid
        cells={cells}
        setCells={setCells}
      />

      <BoardActions
        onClear={handleClearBoard}
        onSave={handleSaveBoard}
      />
    </section>
  );
}