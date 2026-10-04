type BoardActionsProps = {
  onClear: () => void;
  onSave: () => void;
  onExport: () => void;
  onToggleCloset: () => void;
  showCloset: boolean;
};

export default function BoardActions({
  onClear,
  onSave,
  onExport,
  onToggleCloset,
  showCloset,
}: BoardActionsProps) {
  return (
    <div className="flex w-[min(90vw,75vh)] max-w-[600px] justify-between">
      {/* Left side */}
      <div className="flex w-40 flex-col gap-3">
        <button
          type="button"
          onClick={onToggleCloset}
          className="w-full rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          {showCloset
            ? 'Close Closet'
            : 'Add from Closet'}
        </button>

        <button
          type="button"
          onClick={onExport}
          className="w-full rounded-lg border border-black bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
        >
          Export Image
        </button>
      </div>

      {/* Right side */}
      <div className="flex w-40 flex-col gap-3">
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          Save Board
        </button>

        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
        >
          Clear Board
        </button>
      </div>
    </div>
  );
}