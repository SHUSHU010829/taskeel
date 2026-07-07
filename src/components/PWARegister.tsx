'use client';

import { useEffect } from 'react';

// Registers the service worker (needed for the installable PWA prompt).
export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // registration failure is non-fatal
      });
    }
  }, []);
  return null;
}
