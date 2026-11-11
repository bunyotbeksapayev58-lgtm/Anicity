import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieBanner from '@/components/CookieBanner';
import GoogleAnalytics from '@/components/GoogleAnalytics';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://anicity-app.vercel.app';

export const metadata = {
  title: {
    default: 'Anicity — Premium Anime Cinema Platformasi',
    template: '%s — Anicity',
  },
  description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda, o‘zbek tilidagi subtitrlar bilan tomosha qiling.',
  keywords: ['anime', 'anicity', 'anime uzbekcha', 'uzbek subtitr', 'anime streaming', 'code geass', 'anime onlayn'],
  authors: [{ name: 'Anicity Team' }],
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
  },
  openGraph: {
    title: 'Anicity — Premium Anime Cinema Platformasi',
    description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda tomosha qiling.',
    url: siteUrl,
    siteName: 'Anicity',
    locale: 'uz_UZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anicity — Premium Anime Cinema Platformasi',
    description: 'Sevimli anime filmlaringiz va seriallaringizni 4K va Full HD sifatda tomosha qiling.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  themeColor: '#07080c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Anicity',
        description: 'Premium Anime Cinema Platformasi',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/catalog?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
        inLanguage: 'uz-UZ',
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'Anicity',
        url: siteUrl,
        logo: `${siteUrl}/icon.png`,
        sameAs: [
          'https://t.me/anicity_uz',
          'https://instagram.com/anicity_uz',
          'https://youtube.com/@anicity_uz',
        ],
      },
    ],
  };

  return (
    <html lang="uz">
      <head>
        {/* Resource Hints & Performance Prefetching */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
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
        {/* Structured Data (Schema.org) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <GoogleAnalytics />
        <Header />
        <main className="main-content-pro">{children}</main>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
