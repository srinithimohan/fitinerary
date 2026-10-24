import { createRoot } from 'react-dom/client';
import { ClosetProvider } from '@/app/context/closet-context';
import Closet from '@/app/ui/closet/closet';
import OutfitBuilder from '@/app/ui/board/outfit-builder';
import PastBoardsPage from '@/app/past-boards/page';

// Real client components, isolated from Clerk/Next server and live services.
// This is component-browser coverage, not authenticated application E2E.
const view = new URLSearchParams(window.location.search).get('view');
createRoot(document.getElementById('root')!).render(
  <ClosetProvider>
    {view === 'board' ? <OutfitBuilder /> : view === 'past' ? <PastBoardsPage /> : <Closet />}
  </ClosetProvider>,
);
