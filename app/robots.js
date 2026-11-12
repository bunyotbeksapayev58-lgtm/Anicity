import { getSiteUrl } from '../lib/siteUrl.js';

export default function robots() {
  const baseUrl = getSiteUrl();
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
