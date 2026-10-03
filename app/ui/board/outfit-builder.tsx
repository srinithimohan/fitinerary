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

/*
 * Loads an image so it can be drawn
 * onto the export canvas.
 */
async function loadCanvasImage(
  imageUrl: string
): Promise<HTMLImageElement> {
  /*
   * Fetch the image first and turn it
   * into a local blob URL.
   *
   * This is especially useful for
   * private Supabase signed URLs.
   */
  const response =
    await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      'Could not load an image for export.'
    );
  }

  const blob =
    await response.blob();

  const localUrl =
    URL.createObjectURL(blob);

  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        URL.revokeObjectURL(
          localUrl
        );

        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(
          localUrl
        );

        reject(
          new Error(
            'Could not load image for export.'
          )
        );
      };

      image.src = localUrl;
    }
  );
}

/*
 * Draws an image like CSS
 * object-fit: cover.
 */
function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio =
    image.width / image.height;

  const cellRatio =
    width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth =
    image.width;
  let sourceHeight =
    image.height;

  if (imageRatio > cellRatio) {
    /*
     * Image is wider than the cell.
     * Crop the sides.
     */
    sourceWidth =
      image.height *
      cellRatio;

    sourceX =
      (image.width -
        sourceWidth) /
      2;
  } else {
    /*
     * Image is taller than the cell.
     * Crop the top and bottom.
     */
    sourceHeight =
      image.width /
      cellRatio;

    sourceY =
      (image.height -
        sourceHeight) /
      2;
  }

  context.drawImage(
    image,

    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,

    x,
    y,
    width,
    height
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

  const [
    isExporting,
    setIsExporting,
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

  async function handleExport() {
    if (isExporting) {
      return;
    }

    const hasItems =
      cells.some(
        (cell) =>
          cell.image !== null
      );

    if (!hasItems) {
      window.alert(
        'Add at least one item before exporting your board.'
      );

      return;
    }

    setIsExporting(true);

    try {
      /*
       * Export at 1800x1800 so the
       * resulting PNG is high resolution.
       */
      const canvas =
        document.createElement(
          'canvas'
        );

      const canvasSize =
        1800;

      const gap = 16;

      const cellSize =
        (canvasSize -
          gap * 2) /
        3;

      canvas.width =
        canvasSize;

      canvas.height =
        canvasSize;

      const context =
        canvas.getContext(
          '2d'
        );

      if (!context) {
        throw new Error(
          'Canvas is not supported.'
        );
      }

      /*
       * White board background.
       */
      context.fillStyle =
        '#ffffff';

      context.fillRect(
        0,
        0,
        canvasSize,
        canvasSize
      );

      for (
        let index = 0;
        index < cells.length;
        index++
      ) {
        const cell =
          cells[index];

        const row =
          Math.floor(
            index / 3
          );

        const column =
          index % 3;

        const x =
          column *
          (cellSize + gap);

        const y =
          row *
          (cellSize + gap);

        /*
         * Empty cell background.
         */
        context.fillStyle =
          '#ffffff';

        context.fillRect(
          x,
          y,
          cellSize,
          cellSize
        );

        if (cell.image) {
          const image =
            await loadCanvasImage(
              cell.image
            );

          drawImageCover(
            context,
            image,
            x,
            y,
            cellSize,
            cellSize
          );
        }

        /*
         * Draw the black cell border
         * from your actual board.
         */
        context.strokeStyle =
          '#000000';

        context.lineWidth =
          3;

        context.strokeRect(
          x,
          y,
          cellSize,
          cellSize
        );
      }

      const blob =
        await new Promise<Blob>(
          (
            resolve,
            reject
          ) => {
            canvas.toBlob(
              (result) => {
                if (!result) {
                  reject(
                    new Error(
                      'Could not create PNG.'
                    )
                  );

                  return;
                }

                resolve(
                  result
                );
              },
              'image/png'
            );
          }
        );

      const downloadUrl =
        URL.createObjectURL(
          blob
        );

      const cleanName =
        (
          boardName ||
          'fitinerary-board'
        )
          .trim()
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            '-'
          )
          .replace(
            /^-+|-+$/g,
            ''
          );

      const link =
        document.createElement(
          'a'
        );

      link.href =
        downloadUrl;

      link.download =
        `${
          cleanName ||
          'fitinerary-board'
        }.png`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        downloadUrl
      );
    } catch (error) {
      console.error(
        'Export failed:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Could not export the board image.';

      window.alert(
        message
      );
    } finally {
      setIsExporting(
        false
      );
    }
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
        onExport={
          handleExport
        }
      />

      {isSaving && (
        <p className="text-sm text-gray-500">
          {editingBoardId
            ? 'Updating board...'
            : 'Saving board...'}
        </p>
      )}

      {isExporting && (
        <p className="text-sm text-gray-500">
          Exporting image...
        </p>
      )}
    </div>
  );
}