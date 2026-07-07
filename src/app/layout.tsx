import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'taskeel',
  description: 'A dev task tracker bound to git branches and deploys.',
  appleWebApp: {
    capable: true,
    title: 'taskeel',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0e10',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
