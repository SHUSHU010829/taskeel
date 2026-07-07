import type { MetadataRoute } from 'next';

// Web App Manifest — makes taskeel installable ("Add to Home Screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Taskeel',
    short_name: 'Taskeel',
    description: '綁定 git 分支與部署的任務追蹤器',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0e10',
    theme_color: '#0d0e10',
    lang: 'zh-Hant',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
