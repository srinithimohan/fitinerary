'use client';

import {
  useEffect,
  useState,
} from 'react';

import OutfitGrid from './outfit-grid';
import BoardActions from './board-actions';

export type GridCell = {
  id: string;
  image: string | null;
  clothingItemId: string | null;
  file: File | null;
  snapshotPath: string | null;
};

function createInitialCells(): GridCell[] {
  return Array.from(
    { length: 9 },
    (_, index) => ({
      id: `cell-${index}`,
      image: null,
      clothingItemId: null,
      file: null,
      snapshotPath: null,
    })
  );
}

export default function OutfitBuilder() {
  const [cells, setCells] =
    useState<GridCell[]>(
      createInitialCells()
    );

  const [
    editingBoardId,
    setEditingBoardId,
  ] = useState<string | null>(
    null
  );

  const [
    boardName,
    setBoardName,
  ] = useState('');

  const [
    isLoadingBoard,
    setIsLoadingBoard,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    const boardId =
      searchParams.get(
        'boardId'
      );

    if (!boardId) {
      return;
    }

    async function loadBoard() {
      setIsLoadingBoard(true);

      try {
        const response =
          await fetch(
            `/api/boards/${boardId}`
          );

        const responseText =
          await response.text();

        let data: any = {};

        if (responseText) {
          try {
            data =
              JSON.parse(
                responseText
              );
          } catch {
            throw new Error(
              `Server returned an invalid response: ${responseText}`
            );
          }
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              `Could not load board. Status: ${response.status}`
          );
        }

        const loadedCells =
          createInitialCells();

        for (
          const item of
          data.items
        ) {
          loadedCells[
            item.position
          ] = {
            id: `cell-${item.position}`,
            image:
              item.image,
            clothingItemId:
              item.clothingItemId,
            file: null,
            snapshotPath:
              item.imagePath,
          };
        }

        setCells(
          loadedCells
        );

        setBoardName(
          data.name
        );

        setEditingBoardId(
          data.id
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not load board.';

        window.alert(
          message
        );
      } finally {
        setIsLoadingBoard(
          false
        );
      }
    }

    loadBoard();
  }, []);

  function handleClear() {
    cells.forEach(
      (cell) => {
        if (
          cell.file &&
          cell.image
        ) {
          URL.revokeObjectURL(
            cell.image
          );
        }
      }
    );

    setCells(
      createInitialCells()
    );
  }

  function handleExitEditMode() {
    handleClear();

    setEditingBoardId(
      null
    );

    setBoardName('');

    window.history.replaceState(
      {},
      '',
      '/'
    );
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const hasItems =
      cells.some(
        (cell) =>
          cell.image !== null
      );

    if (!hasItems) {
      window.alert(
        'Add at least one item before saving your board.'
      );

      return;
    }

    const enteredName =
      window.prompt(
        editingBoardId
          ? 'Update board name:'
          : 'Name your board:',
        boardName
      );

    if (
      enteredName === null
    ) {
      return;
    }

    const finalName =
      enteredName.trim() ||
      'Untitled Board';

    const items =
      cells
        .map(
          (
            cell,
            position
          ) => ({
            position,

            clothingItemId:
              cell.clothingItemId,

            hasUpload:
              cell.file !==
              null,

            snapshotPath:
              cell.snapshotPath,
          })
        )
        .filter(
          (item) =>
            item.clothingItemId !==
              null ||
            item.hasUpload ||
            item.snapshotPath !==
              null
        );

    const formData =
      new FormData();

    formData.append(
      'name',
      finalName
    );

    formData.append(
      'items',
      JSON.stringify(items)
    );

    cells.forEach(
      (
        cell,
        position
      ) => {
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
      const url =
        editingBoardId
          ? `/api/boards/${editingBoardId}`
          : '/api/boards';

      const method =
        editingBoardId
          ? 'PATCH'
          : 'POST';

      const response =
        await fetch(
          url,
          {
            method,
            body: formData,
          }
        );

      /*
       * Read as text first.
       *
       * This prevents:
       * "Unexpected end of JSON input"
       * when the server returns an
       * empty response.
       */
      const responseText =
        await response.text();

      let data: any = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            `Server returned an invalid response: ${responseText}`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Could not save board. Status: ${response.status}`
        );
      }

      if (!data.name) {
        throw new Error(
          'Board saved, but the server returned an incomplete response.'
        );
      }

      setBoardName(
        data.name
      );

      if (
        editingBoardId
      ) {
        window.alert(
          `"${data.name}" updated successfully!`
        );
      } else {
        window.alert(
          `"${data.name}" saved successfully!`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not save board.';

      window.alert(
        message
      );

      console.error(
        'Board save failed:',
        error
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingBoard) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <p className="text-gray-500">
          Loading board...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {editingBoardId && (
        <div className="flex items-center gap-4 rounded-lg bg-gray-100 px-4 py-2">
          <p className="text-sm">
            Editing{' '}
            <span className="font-semibold">
              {boardName}
            </span>
          </p>

          <button
            type="button"
            onClick={
              handleExitEditMode
            }
            className="text-sm font-medium text-gray-600 hover:text-black"
          >
            Exit Edit Mode
          </button>
        </div>
      )}

      <OutfitGrid
        cells={cells}
        setCells={setCells}
      />

      <BoardActions
        onClear={
          handleClear
        }
        onSave={
          handleSave
        }
      />

      {isSaving && (
        <p className="text-sm text-gray-500">
          {editingBoardId
            ? 'Updating board...'
            : 'Saving board...'}
        </p>
      )}
    </div>
  );
}