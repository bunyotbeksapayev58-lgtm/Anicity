export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://anicity-app.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/assistant-admin',
          '/assistant-admin/',
          '/profile',
          '/profile/',
          '/history',
          '/favorites',
          '/forgot-password',
          '/reset-password',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
