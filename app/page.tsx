import OutfitGrid from './ui/board/outfit-grid';
import OutfitBuilder from './ui/board/outfit-builder';

export default function HomePage() {
  return (
    <main>
      <h1 className="text-5xl font-bold text-blue-500">Build Your Travel Wardrobe</h1>

      <OutfitBuilder />
    </main>
  );
}