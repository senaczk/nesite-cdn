import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'NESITE CDN — Upload Once. Share Everywhere.',
  description:
    'One interface. Multiple file hosts. Upload a file to a verified public file host and get the direct URL back.',
  applicationName: 'NESITE CDN',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08080b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">{children}</div>
      </body>
    </html>
  );
}