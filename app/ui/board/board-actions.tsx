type BoardActionsProps = {
  onClear: () => void;
  onSave: () => void;
  onExport: () => void;
};

export default function BoardActions({
  onClear,
  onSave,
  onExport,
}: BoardActionsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
      >
        Clear Board
      </button>

      <button
        type="button"
        onClick={onExport}
        className="rounded-lg border border-black bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
      >
        Export Image
      </button>

      <button
        type="button"
        onClick={onSave}
        className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
      >
        Save Board
      </button>
    </div>
  );
}