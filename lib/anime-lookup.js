/**
 * Checks whether an identifier string is a valid canonical RFC 4122 UUID.
 * @param {any} s
 * @returns {boolean}
 */
export function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

/**
 * Sanitizes a user-supplied slug or title identifier into an alphanumeric-dominant
 * search pattern suitable for safe PostgREST ilike matching.
 * Returns null if the identifier contains no alphanumeric characters.
 *
 * @param {string} slug
 * @returns {string|null}
 */
export function sanitizeSlugPattern(slug) {
  const alphanumericOnly = String(slug || '').replace(/[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]/g, '');
  if (!alphanumericOnly) {
    return null;
  }
  return String(slug || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F\s-_]/g, '')
    .replace(/[-_\s]+/g, '%');
}

/**
 * Applies either UUID exact matching or slug/title ilike filter to an animes query builder.
 * Guarantees that passing a slug (e.g. 'code-geass') will never trigger PostgreSQL error 22P02.
 *
 * @param {any} query - Supabase PostgREST query builder
 * @param {string} identifier - UUID or URL slug
 * @returns {any}
 */
export function applyAnimeIdentifierFilter(query, identifier) {
  const raw = String(identifier || '').trim();
  if (isUuid(raw)) {
    return query.eq('id', raw);
  }
  const pattern = sanitizeSlugPattern(raw);
  if (!pattern) {
    // Guaranteed non-matching UUID fallback without throwing 22P02
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  return query.or(`title.ilike.%${pattern}%,alt_title.ilike.%${pattern}%`);
}
