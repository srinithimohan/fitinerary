'use client';

type BoardActionsProps = {
  onClear: () => void;
  onSave: () => void;
};

export default function BoardActions({
  onClear,
  onSave,
}: BoardActionsProps) {
  return (
    <div className="mt-6 flex gap-4">
      <button
        type="button"
        onClick={onSave}
        className="
          rounded-md
          bg-black
          px-4
          py-2
          text-white
          hover:bg-gray-800
        "
      >
        Save Board
      </button>

      <button
        type="button"
        onClick={onClear}
        className="
          rounded-md
          border
          border-black
          px-4
          py-2
          hover:bg-gray-100
        "
      >
        Clear Board
      </button>
    </div>
  );
}