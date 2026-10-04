import OutfitBuilder from './ui/board/outfit-builder';
import { orbitron } from './ui/fonts';

export default function HomePage() {
  return (
    <main className="pt-1 sm:pt-2 md:pt-3 lg:pt-4">
      <h1
        className={`${orbitron.className} text-center text-4xl font-bold text-[#4D5382] sm:text-5xl`}
      >
        fitinerary
      </h1>

      <OutfitBuilder />
    </main>
  );
}