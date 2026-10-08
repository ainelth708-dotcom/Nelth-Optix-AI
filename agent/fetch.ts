import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * SSRF-safe fetch (§12). Every server-side tool call goes through here:
 * - http/https only, no credentials in URL
 * - hostname must belong to the caller-provided allowlist (our tools only
 *   ever call fixed public hosts — user input only fills query/path params)
 * - resolved IPs are rejected when private/loopback/link-local/reserved,
 *   which blocks localhost, LAN, and cloud-metadata (169.254.169.254) access
 * - short timeouts, JSON/text helpers that never throw raw bodies at callers
 */

export const FETCH_TIMEOUT_MS = 12_000
const UA = { 'User-Agent': 'Nelth-Agent/1.0 (+https://nelth-ai-mg.vercel.app)' }

function ipv4Private(parts: number[]): boolean {
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 0) return true
  if (a >= 224 && a <= 239) return true
  if (a === 192 && (b === 0 || b === 2)) return true
  if (a === 198 && (b === 18 || b === 19 || b === 51 || b === 100)) return true
  if (a === 203 && b === 0 && parts[2] === 113) return true
  return false
}

export function isPrivateIp(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, '')
  // IPv4-mapped IPv6 → check the inner IPv4.
  const mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = mapped?.[1] ?? (isIP(clean) === 4 ? clean : null)
  if (v4) {
    const parts = v4.split('.').map(Number)
    if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
    return ipv4Private(parts as number[])
  }
  if (isIP(clean) === 6) {
    if (clean === '::1' || clean === '::') return true
    if (clean.startsWith('fe80:')) return true
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true
    if (clean.startsWith('ff')) return true
    return false
  }
  return true
}

function hostAllowed(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return allowedHosts.some(allowed => {
    const base = allowed.toLowerCase().replace(/\.$/, '')
    return host === base || host === `www.${base}`
  })
}

export type SafeFetchOptions = {
  allowedHosts: string[]
  timeoutMs?: number
}

/**
 * Standalone guards for callers with custom request shapes (MCP handshake):
 * same allowlist + private-IP resolution checks as safeFetch.
 */
export async function assertPublicHttpsUrl(
  url: string,
  allowedHosts: string[]
): Promise<string> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('Only https URLs allowed.')
  if (parsed.username || parsed.password) throw new Error('Credentials in URL are not allowed.')
  if (!hostAllowed(parsed.hostname, allowedHosts)) {
    throw new Error(`Host not allowlisted: ${parsed.hostname}`)
  }
  const records = await lookup(parsed.hostname, { all: true })
  if (records.length === 0 || records.some(r => isPrivateIp(r.address))) {
    throw new Error(`Host resolves to a private address: ${parsed.hostname}`)
  }
  return parsed.hostname
}

async function safeFetch(
  url: string,
  opts: SafeFetchOptions
): Promise<Response> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are allowed.')
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URL are not allowed.')
  }
  if (!hostAllowed(parsed.hostname, opts.allowedHosts)) {
    throw new Error(`Host not allowlisted: ${parsed.hostname}`)
  }
  // Resolve-then-check: blocks DNS rebinding to private ranges.
  const records = await lookup(parsed.hostname, { all: true })
  if (records.length === 0 || records.some(r => isPrivateIp(r.address))) {
    throw new Error(`Host resolves to a private address: ${parsed.hostname}`)
  }
  return fetch(url, {
    headers: UA,
    signal: AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS)
  })
}

export async function safeFetchJson(
  url: string,
  opts: SafeFetchOptions
): Promise<unknown> {
  const response = await safeFetch(url, opts)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as unknown
}

export async function safeFetchText(
  url: string,
  opts: SafeFetchOptions
): Promise<string> {
  const response = await safeFetch(url, opts)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}
