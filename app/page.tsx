import OutfitGrid from './ui/board/outfit-grid';
import OutfitBuilder from './ui/board/outfit-builder';

export default function HomePage() {
  return (
    <main>
      <h1 className="text-center text-5xl font-bold text-pink-500">fitinerary</h1>

      <OutfitBuilder />
    </main>
  );
}