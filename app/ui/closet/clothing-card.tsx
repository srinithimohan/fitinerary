type ClothingCardProps = {
  id: string;
  image: string;
  name: string;
  onDelete: (id: string) => void;
};

export default function ClothingCard({
  id,
  image,
  name,
  onDelete,
}: ClothingCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex items-center justify-between p-3">
        <p className="truncate font-medium">{name}</p>

        <button
          type="button"
          onClick={() => onDelete(id)}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}