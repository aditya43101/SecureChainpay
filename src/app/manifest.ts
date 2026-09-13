import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SecureChain Pay | Decentralized Non-Custodial Payments',
    short_name: 'SecureChain',
    description: 'Enterprise Non-Custodial Blockchain Payments & Autonomous Trading',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05070D',
    theme_color: '#EAB308',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
