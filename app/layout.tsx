import './ui/global.css';
import Navbar from './ui/navbar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />

        {children} {/* the content inside each page passed */}
      </body>
    </html>
  );
}