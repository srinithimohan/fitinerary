export type ClothingItem = {
  id: string;
  image: string;
  imagePath: string;
  name: string;
  category: string;
};

export type Board = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  slots: BoardSlot[];
};

export type BoardSlot = {
  position: number;
  clothingItemId: string | null;
};

export type GridCell = {
  id: string;
  image: string | null;
  clothingItemId: string | null;
};