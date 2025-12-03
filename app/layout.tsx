import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NovaMachine - AI Video Generator',
  description: 'Node-based AI Video Generator powered by KLing O1 models',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
