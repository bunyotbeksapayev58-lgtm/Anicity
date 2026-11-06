import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: {
    default: 'Anicity — Premium Anime Cinema Platformasi',
    template: '%s — Anicity',
  },
  description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda, o‘zbek tilidagi subtitrlar bilan tomosha qiling.',
  keywords: ['anime', 'anicity', 'anime uzbekcha', 'uzbek subtitr', 'anime streaming', 'suzume', 'your name', 'anime onlayn'],
  authors: [{ name: 'Anicity Team' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://anicity-app.vercel.app'),
  openGraph: {
    title: 'Anicity — Premium Anime Cinema Platformasi',
    description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda tomosha qiling.',
    url: 'https://anicity-app.vercel.app',
    siteName: 'Anicity',
    locale: 'uz_UZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anicity — Premium Anime Cinema Platformasi',
    description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda tomosha qiling.',
  },
};

export const viewport = {
  themeColor: '#07080c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body>
        <Header />
        <main className="main-content-pro">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
