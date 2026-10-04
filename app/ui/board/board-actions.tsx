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
          className="w-full rounded-lg bg-[#98CE00] px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          {showCloset
            ? 'close closet'
            : 'add from closet'}
        </button>

        <button
          type="button"
          onClick={onExport}
          className="w-full rounded-lg bg-[#16E0BD] px-4 py-2 font-medium text-white hover:bg-gray-100"
        >
          export image
        </button>
      </div>

      {/* Right side */}
      <div className="flex w-40 flex-col gap-3">
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-lg bg-[#89A6FB] px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          save board
        </button>

        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-lg bg-[#7B4B94] px-4 py-2 font-medium text-white hover:bg-gray-100"
        >
          clear board
        </button>
      </div>
    </div>
  );
}