'use client';

import { useState } from 'react';
import OutfitGrid from './outfit-grid';
import BoardActions from './board-actions';

export default function OutfitBuilder() {
  const [items, setItems] = useState<(string | null)[]>(
    Array(9).fill(null)
  );

  return (
    <>
      <OutfitGrid
        items={items}
        setItems={setItems}
      />

      <BoardActions items={items} />
    </>
  );
}