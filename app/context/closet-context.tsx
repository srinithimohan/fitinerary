'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import type { ClothingItem } from '@/app/lib/definitions';

type ClosetContextType = {
  clothes: ClothingItem[];

  setClothes: Dispatch<
    SetStateAction<ClothingItem[]>
  >;

  categories: string[];

  setCategories: Dispatch<
    SetStateAction<string[]>
  >;

  isLoading: boolean;
};

const ClosetContext =
  createContext<
    ClosetContextType | undefined
  >(undefined);

export function ClosetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [clothes, setClothes] =
    useState<ClothingItem[]>([]);

  const [categories, setCategories] =
    useState<string[]>([
      'All',
      'Tops',
      'Bottoms',
      'Layers',
      'Shoes',
    ]);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    async function loadClothes() {
      try {
        const response = await fetch(
          '/api/clothing'
        );

        if (response.status === 401) {
          setClothes([]);
          return;
        }

        if (!response.ok) {
          throw new Error(
            'Failed to load clothing'
          );
        }

        const data: ClothingItem[] =
          await response.json();

        setClothes(data);

        setCategories(
          (currentCategories) => {
            const newCategories =
              data
                .map(
                  (item) =>
                    item.category
                )
                .filter(
                  (category) =>
                    !currentCategories.some(
                      (existing) =>
                        existing.toLowerCase() ===
                        category.toLowerCase()
                    )
                );

            return [
              ...currentCategories,
              ...newCategories,
            ];
          }
        );
      } catch (error) {
        console.error(
          'Could not load closet:',
          error
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadClothes();
  }, []);

  return (
    <ClosetContext.Provider
      value={{
        clothes,
        setClothes,
        categories,
        setCategories,
        isLoading,
      }}
    >
      {children}
    </ClosetContext.Provider>
  );
}

export function useCloset() {
  const context =
    useContext(ClosetContext);

  if (context === undefined) {
    throw new Error(
      'useCloset must be used inside a ClosetProvider'
    );
  }

  return context;
}