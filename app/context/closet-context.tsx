'use client';

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import type { ClothingItem } from '@/app/lib/definitions';

type ClosetContextType = {
  clothes: ClothingItem[];
  setClothes: Dispatch<SetStateAction<ClothingItem[]>>;

  categories: string[];
  setCategories: Dispatch<SetStateAction<string[]>>;
};

const ClosetContext = createContext<ClosetContextType | undefined>(
  undefined
);

export function ClosetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [clothes, setClothes] = useState<ClothingItem[]>([]);

  const [categories, setCategories] = useState<string[]>([
    'All',
    'Tops',
    'Bottoms',
    'Layers',
    'Shoes',
  ]);

  return (
    <ClosetContext.Provider
      value={{
        clothes,
        setClothes,
        categories,
        setCategories,
      }}
    >
      {children}
    </ClosetContext.Provider>
  );
}

export function useCloset() {
  const context = useContext(ClosetContext);

  if (context === undefined) {
    throw new Error(
      'useCloset must be used inside a ClosetProvider'
    );
  }

  return context;
}