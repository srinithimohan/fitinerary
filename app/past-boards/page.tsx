'use client';

import {
  useEffect,
  useState,
} from 'react';

import type {
  SavedBoard,
  SavedBoardItem,
} from '@/app/lib/definitions';

export default function PastBoardsPage() {
  const [
    boards,
    setBoards,
  ] = useState<SavedBoard[]>([]);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    selectedBoard,
    setSelectedBoard,
  ] = useState<SavedBoard | null>(
    null
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function loadBoards() {
      try {
        const response =
          await fetch(
            '/api/past-boards'
          );

        const data =
          await response.json();

        if (!response.ok) {
          setError(
            typeof data.error ===
              'string'
              ? data.error
              : 'Could not load boards.'
          );

          return;
        }

        setBoards(
          data as SavedBoard[]
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not load boards.';

        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadBoards();
  }, []);

  async function handleDeleteBoard(
    board: SavedBoard
  ) {
    const confirmed =
      window.confirm(
        `Delete "${board.name}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      const response =
        await fetch(
          `/api/boards/${board.id}`,
          {
            method: 'DELETE',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          typeof data.error ===
            'string'
            ? data.error
            : 'Could not delete board.'
        );

        return;
      }

      setBoards(
        (currentBoards) =>
          currentBoards.filter(
            (currentBoard) =>
              currentBoard.id !==
              board.id
          )
      );

      setSelectedBoard(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not delete board.';

      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  const visibleBoards =
    boards.filter((board) =>
      board.name
        .toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Past Boards
        </h1>

        <p className="mt-2 text-gray-500">
          View your saved travel
          wardrobes.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(
            event.target.value
          )
        }
        placeholder="Search boards..."
        className="mb-8 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
      />

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Boards */}
      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <p className="text-gray-500">
            Loading boards...
          </p>
        </div>
      ) : visibleBoards.length ===
        0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">
            {searchTerm
              ? 'No boards match your search.'
              : 'You have not saved any boards yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBoards.map(
            (board) => (
              <button
                key={board.id}
                type="button"
                onClick={() =>
                  setSelectedBoard(
                    board
                  )
                }
                className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <BoardGrid
                  board={board}
                />

                <div className="p-4">
                  <h2 className="font-semibold">
                    {board.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(
                      board.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>
              </button>
            )
          )}
        </div>
      )}

      {/* Enlarged board modal */}
      {selectedBoard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() =>
            setSelectedBoard(null)
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Modal header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {
                    selectedBoard.name
                  }
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {new Date(
                    selectedBoard.createdAt
                  ).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedBoard(
                    null
                  )
                }
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            {/* Enlarged 3x3 board */}
            <BoardGrid
              board={
                selectedBoard
              }
              large
            />

            {/* Board actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              {/*
                EDIT BOARD WILL GO HERE NEXT.

                Eventually this will take the user
                back to something like:

                /?boardId=<board-id>

                Then the home page will load that
                exact board into OutfitBuilder.
              */}

              <button
                type="button"
                disabled={
                  isDeleting
                }
                onClick={() =>
                  handleDeleteBoard(
                    selectedBoard
                  )
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting
                  ? 'Deleting...'
                  : 'Delete Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BoardGrid({
  board,
  large = false,
}: {
  board: SavedBoard;
  large?: boolean;
}) {
  const cells =
    Array.from(
      { length: 9 },
      (_, position) =>
        board.items.find(
          (item) =>
            item.position ===
            position
        ) ?? null
    );

  return (
    <div
      className={`grid grid-cols-3 gap-1 bg-gray-200 p-1 ${
        large
          ? 'w-full'
          : 'aspect-square'
      }`}
    >
      {cells.map(
        (item, position) => (
          <BoardCell
            key={position}
            item={item}
          />
        )
      )}
    </div>
  );
}

function BoardCell({
  item,
}: {
  item: SavedBoardItem | null;
}) {
  return (
    <div className="aspect-square overflow-hidden bg-white">
      {item?.image ? (
        <img
          src={item.image}
          alt={
            item.name ??
            'Saved outfit item'
          }
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-gray-50" />
      )}
    </div>
  );
}