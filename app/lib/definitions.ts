export type ClothingItem = {
  id: string;
  userId: string;
  imageUrl: string;
  name?: string;
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