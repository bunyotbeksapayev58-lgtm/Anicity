'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useReportWebVitals } from 'next/web-vitals';

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('anicity_cookie_consent');
      if (consent === 'essential') {
        setAllowed(false);
      }
    } catch {}

    const handleConsent = (e) => {
      if (e.detail === 'essential') {
        setAllowed(false);
      } else {
        setAllowed(true);
      }
    };

    window.addEventListener('cookie_consent_updated', handleConsent);
    return () => window.removeEventListener('cookie_consent_updated', handleConsent);
  }, []);

  // Real User Monitoring (RUM): Core Web Vitals to GA4
  useReportWebVitals((metric) => {
    if (typeof window !== 'undefined' && window.gtag && allowed && gaId) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });

  // If user explicitly rejected analytics or no IDs provided, render nothing
  if (!allowed || (!gaId && !gtmId)) {
    return null;
  }

  return (
    <>
      {/* Google Tag Manager (GTM) */}
      {gtmId && (
        <>
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* Google Analytics 4 (GA4) */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
                anonymize_ip: true,
                cookie_flags: 'SameSite=None;Secure'
              });
            `}
          </Script>
        </>
      )}
    </>
  );
}
