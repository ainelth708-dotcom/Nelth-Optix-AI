/**
 * URL and Content Sanitizer for Nelth Intelligent UI
 * Ensures model-generated specifications cannot execute code, cross-site script,
 * or leak sensitive tokens.
 */

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Validates and sanitizes a URL. If the URL is safe, returns it untouched.
 * If the URL is suspicious (javascript:, data:text/html, vbscript:), returns empty string.
 */
export function sanitizeUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  // Relative paths are safe
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      return trimmed
    }
    return ''
  } catch {
    // If it cannot be parsed as a full URL, ensure it does not start with protocol:
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      return ''
    }
    return trimmed
  }
}

/**
 * Strips potential HTML script / event-handler injection strings from plain text props.
 */
export function sanitizePlainText(text?: string | null, maxLength = 10000): string {
  if (text == null) return ''
  const str = String(text)
  return str
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, 'data-blocked=')
}

/**
 * Deeply sanitizes all string properties in a component node before rendering.
 */
export function sanitizeComponentProps<T extends Record<string, any>>(props: T): T {
  if (!props || typeof props !== 'object') return props
  const out: Record<string, any> = Array.isArray(props) ? [] : {}

  for (const [key, val] of Object.entries(props)) {
    if (typeof val === 'string') {
      if (key === 'url' || key === 'link' || key === 'image') {
        out[key] = sanitizeUrl(val)
      } else {
        out[key] = sanitizePlainText(val)
      }
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeComponentProps(val)
    } else {
      out[key] = val
    }
  }

  return out as T
}

