import './ui/global.css';
import Navbar from './ui/navbar';
import { ClosetProvider } from './context/closet-context';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClosetProvider>
        <Navbar />

        {children} 
        </ClosetProvider>
      </body>
    </html>
  );
}