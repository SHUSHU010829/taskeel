import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'taskeel',
  description: 'A dev task tracker bound to git branches and deploys.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
