'use client';

import { useState } from 'react';

import OutfitGrid from './outfit-grid';
import BoardActions from './board-actions';

export type GridCell = {
  id: string;
  image: string | null;
  clothingItemId: string | null;

  // Only used when someone uploads an image
  // directly into the board.
  file: File | null;
};

function createInitialCells(): GridCell[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `cell-${index}`,
    image: null,
    clothingItemId: null,
    file: null,
  }));
}

export default function OutfitBuilder() {
  const [cells, setCells] = useState<GridCell[]>(
    createInitialCells()
  );

  const [isSaving, setIsSaving] =
    useState(false);

  function handleClear() {
    // Clean up temporary browser URLs
    // created for direct uploads.
    cells.forEach((cell) => {
      if (cell.file && cell.image) {
        URL.revokeObjectURL(cell.image);
      }
    });

    setCells(createInitialCells());
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const hasItems = cells.some(
      (cell) => cell.image !== null
    );

    if (!hasItems) {
      window.alert(
        'Add at least one item before saving your board.'
      );

      return;
    }

    const boardName = window.prompt(
      'Name your board:'
    );

    // User pressed Cancel.
    if (boardName === null) {
      return;
    }

    const finalName =
      boardName.trim() || 'Untitled Board';

    /*
     * Only send occupied cells.
     *
     * position = where the item appears
     * on the 3x3 board.
     */
    const items = cells
      .map((cell, position) => ({
        position,
        clothingItemId:
          cell.clothingItemId,
        hasUpload: cell.file !== null,
      }))
      .filter(
        (item) =>
          item.clothingItemId !== null ||
          item.hasUpload
      );

    const formData = new FormData();

    formData.append(
      'name',
      finalName
    );

    formData.append(
      'items',
      JSON.stringify(items)
    );

    /*
     * Direct board uploads need their
     * actual File sent to the server.
     */
    cells.forEach(
      (cell, position) => {
        if (cell.file) {
          formData.append(
            `file-${position}`,
            cell.file
          );
        }
      }
    );

    setIsSaving(true);

    try {
      const response = await fetch(
        '/api/boards',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        window.alert(
          typeof data.error ===
            'string'
            ? data.error
            : 'Could not save board.'
        );

        return;
      }

      window.alert(
        `"${data.name}" saved successfully!`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not save board.';

      window.alert(message);
    } finally {
      setIsSaving(false);
    }
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

      {isSaving && (
        <p className="text-sm text-gray-500">
          Saving board...
        </p>
      )}
    </div>
  );
}