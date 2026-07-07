import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'Taskeel',
  description: 'A dev task tracker bound to git branches and deploys.',
  appleWebApp: {
    capable: true,
    title: 'Taskeel',
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
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var f=localStorage.getItem('taskeel.fontPx');if(f)document.documentElement.style.setProperty('--app-font',f+'px')}catch(e){}",
          }}
        />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
