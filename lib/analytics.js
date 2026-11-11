// Anicity Analytics & Event Tracking Helper
// Supports Google Analytics 4 (gtag) and Google Tag Manager (dataLayer)

export function getCookieConsent() {
  if (typeof window === 'undefined') return 'unknown';
  try {
    return localStorage.getItem('anicity_cookie_consent') || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isAnalyticsAllowed() {
  const consent = getCookieConsent();
  return consent === 'accepted' || consent === 'unknown';
}

/**
 * Record a pageview in Google Analytics 4
 * @param {string} url
 */
export function pageview(url) {
  if (typeof window === 'undefined') return;
  if (!isAnalyticsAllowed()) return;

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (window.gtag && gaId) {
    window.gtag('config', gaId, {
      page_path: url,
    });
  }

  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'page_view',
      page_location: url,
    });
  }
}

/**
 * Send custom event to GA4 and GTM
 * @param {Object} options
 * @param {string} options.action - Event name (e.g. 'anime_play', 'subscribe_click')
 * @param {string} [options.category]
 * @param {string} [options.label]
 * @param {number} [options.value]
 * @param {Object} [options.params]
 */
export function trackEvent({ action, category, label, value, params = {} }) {
  if (typeof window === 'undefined') return;
  if (!isAnalyticsAllowed()) return;

  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...params,
    });
  }

  if (window.dataLayer) {
    window.dataLayer.push({
      event: action,
      eventCategory: category,
      eventLabel: label,
      eventValue: value,
      ...params,
    });
  }
}
