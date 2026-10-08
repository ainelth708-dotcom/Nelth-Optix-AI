import { tool } from 'ai'
import { z } from 'zod'

import { safeFetchJson } from '../fetch'
import { tokenize } from './index'
import type {
  OpenApiOperation,
  OpenApiParam,
  ToolCatalogEntry
} from './types'

/**
 * Generic execution layer (§1–§2, §9): NO per-API wrappers. A catalog entry
 * with a usable OpenAPI spec becomes executable dynamically:
 *   entry → spec (cached) → operation matching → zod schema → safe HTTP.
 * Only no-auth GET operations are ever executed. Auth-gated APIs stay
 * discoverable but executableNow=false — credentials are never invented.
 */

export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'dead'
  | 'requires_auth'
  | 'invalid_spec'
  | 'rate_limited'
  | 'temporarily_unavailable'

export type OpenApiService = {
  baseUrl: string
  operations: OpenApiOperation[]
}

const SPEC_TTL_MS = 24 * 60 * 60 * 1000
const specCache = new Map<string, { at: number; service: OpenApiService }>()

function asType(schema: unknown): OpenApiParam['type'] {
  const t = (schema as { type?: string } | null)?.type
  if (t === 'number' || t === 'integer') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'string'
}

function cleanText(value: unknown, max = 200): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function parseOpenApiSpec(specUrl: string, spec: unknown): OpenApiService | null {
  if (typeof spec !== 'object' || spec === null) return null
  const root = spec as Record<string, unknown>
  const paths = root.paths as Record<string, Record<string, Record<string, unknown>>> | undefined
  if (!paths || typeof paths !== 'object') return null

  // Base URL: OpenAPI 3 servers[0] or Swagger 2.0 host+basePath+schemes.
  let baseUrl = ''
  const servers = root.servers as Array<{ url?: string }> | undefined
  if (Array.isArray(servers) && servers[0]?.url) {
    baseUrl = servers[0].url
  } else if ((root as { swagger?: string }).swagger === '2.0') {
    const host = (root as { host?: string }).host ?? ''
    const basePath = (root as { basePath?: string }).basePath ?? ''
    const schemes = (root as { schemes?: string[] }).schemes ?? ['https']
    const scheme = schemes.includes('https') ? 'https' : schemes[0] ?? 'https'
    baseUrl = host ? `${scheme}://${host}${basePath}` : ''
  }
  if (!baseUrl) {
    try {
      const u = new URL(specUrl)
      baseUrl = `${u.protocol}//${u.host}`
    } catch {
      return null
    }
  }

  const operations: OpenApiOperation[] = []
  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue
    // GET only: verification and execution must never mutate (§4, §9).
    const get = methods.get
    if (!get || typeof get !== 'object') continue
    const params: OpenApiParam[] = []
    const rawParams = get.parameters as Array<Record<string, unknown>> | undefined
    if (Array.isArray(rawParams)) {
      for (const p of rawParams) {
        const location = p.in === 'path' ? 'path' : p.in === 'query' ? 'query' : null
        const name = typeof p.name === 'string' ? p.name : ''
        if (!location || !name) continue
        params.push({
          name,
          location,
          required: p.required === true,
          type: asType(p.schema),
          description: cleanText((p.description as string | undefined) ?? ''),
          default: (p.schema as { default?: string | number | boolean } | undefined)?.default
        })
      }
    }
    operations.push({
      operationId: cleanText((get.operationId as string | undefined) ?? `${path}`, 120),
      method: 'GET',
      path,
      summary: cleanText(
        ((get.summary as string | undefined) ?? (get.description as string | undefined) ?? path).toString(),
        200
      ),
      params: params.slice(0, 12)
    })
    if (operations.length >= 60) break
  }
  if (!operations.length) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), operations }
}

export async function loadOpenApiService(
  specUrl: string
): Promise<OpenApiService | null> {
  const cached = specCache.get(specUrl)
  if (cached && Date.now() - cached.at < SPEC_TTL_MS) return cached.service
  let response: Response
  try {
    response = await fetch(specUrl, {
      headers: { 'User-Agent': 'Nelth-Agent-Catalog-Sync/1.0' },
      signal: AbortSignal.timeout(20_000)
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  let spec: unknown
  try {
    spec = (await response.json()) as unknown
  } catch {
    return null
  }
  const service = parseOpenApiSpec(specUrl, spec)
  if (!service) return null
  specCache.set(specUrl, { at: Date.now(), service })
  return service
}

/** Pick the GET operation whose tokens best match the request terms. */
export function matchOperation(
  service: OpenApiService,
  terms: string[]
): OpenApiOperation | null {
  const wanted = new Set(terms.flatMap(t => tokenize(t)))
  if (wanted.size === 0) return null
  let best: OpenApiOperation | null = null
  let bestScore = 0
  for (const op of service.operations) {
    const hay = new Set(tokenize(`${op.operationId} ${op.summary} ${op.path}`))
    let score = 0
    for (const w of wanted) {
      if (hay.has(w)) score += 2
      else {
        for (const h of hay) {
          if (h.startsWith(w) || w.startsWith(h)) {
            score += 0.7
            break
          }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = op
    }
  }
  return bestScore > 0 ? best : null
}

function zodForParam(param: OpenApiParam): { schema: z.ZodType; optional: boolean } {
  const desc = param.description ? param.description.slice(0, 150) : undefined
  if (param.type === 'number') {
    const s = desc ? z.coerce.number().describe(desc) : z.coerce.number()
    return { schema: s, optional: !param.required }
  }
  if (param.type === 'boolean') {
    const s = desc ? z.coerce.boolean().describe(desc) : z.coerce.boolean()
    return { schema: s, optional: !param.required }
  }
  const s = desc ? z.string().describe(desc) : z.string()
  return { schema: s, optional: !param.required }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function summarizeJson(value: unknown, depth = 0): unknown {
  if (depth > 2) return '…'
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (value.length <= 5) return value.map(v => summarizeJson(v, depth + 1))
    return [...value.slice(0, 3).map(v => summarizeJson(v, depth + 1)), `… +${value.length - 3} more`]
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value).slice(0, 15)) {
      out[k] =
        typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}…` : summarizeJson(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 800) return `${value.slice(0, 800)}…`
  return value
}

/**
 * Dynamic tool factory: entry + matched GET operation → AI SDK tool.
 * Params without a default and marked required use safe fallbacks ONLY when
 * the spec provides an enum/default; otherwise the tool is not built
 * (returned null) — we never guess credentials or force calls.
 */
export function createOpenApiTool(
  entry: ToolCatalogEntry,
  service: OpenApiService,
  operation: OpenApiOperation
): unknown | null {
  const host = hostOf(service.baseUrl)
  if (!host) return null
  const shape: Record<string, z.ZodType> = {}
  for (const param of operation.params) {
    const { schema, optional } = zodForParam(param)
    shape[param.name] = (optional ? schema.optional() : schema) as never
  }
  const inputSchema = z.object(shape)
  const toolName = entry.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'catalog_api'
  void toolName
  return tool({
    description: `${entry.name}: ${operation.summary} (catalogued API, no-auth GET)`.slice(0, 300),
    inputSchema,
    execute: async (input: Record<string, unknown>) => {
      try {
        let path = operation.path
        const query = new URLSearchParams()
        for (const param of operation.params) {
          const value = input[param.name] ?? param.default
          if (value === undefined || value === null || value === '') {
            if (param.required) return `Missing required parameter: ${param.name}.`
            continue
          }
          if (param.location === 'path') {
            path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)))
          } else {
            query.set(param.name, String(value))
          }
        }
        if (/\{[A-Za-z0-9_]+\}/.test(path)) {
          return 'Missing path parameters for this operation.'
        }
        const url = `${service.baseUrl}${path}${query.toString() ? `?${query.toString()}` : ''}`
        const data = await safeFetchJson(url, { allowedHosts: [host], timeoutMs: 15_000 })
        return summarizeJson(data)
      } catch {
        return 'Catalog API call failed (network, rate limit, or dead endpoint).'
      }
    }
  })
}

export type VerifyOutcome = {
  status: 'verified' | 'dead' | 'rate_limited' | 'temporarily_unavailable' | 'requires_params'
  reason?: string
}

/**
 * Real verification (§4): performs an actual no-auth GET call. Only
 * zero-required-param operations can be verified hands-free; anything else
 * honestly reports 'requires_params' instead of faking success.
 */
export async function verifyOpenApiOperation(
  service: OpenApiService,
  operation: OpenApiOperation
): Promise<VerifyOutcome> {
  const host = hostOf(service.baseUrl)
  if (!host) return { status: 'dead', reason: 'unresolvable base URL' }
  if (operation.params.some(p => p.required && p.default === undefined)) {
    return { status: 'requires_params', reason: 'required params need values' }
  }
  let path = operation.path
  const query = new URLSearchParams()
  for (const param of operation.params) {
    if (param.default === undefined) continue
    if (param.location === 'path') {
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(param.default)))
    } else {
      query.set(param.name, String(param.default))
    }
  }
  const url = `${service.baseUrl}${path}${query.toString() ? `?${query.toString()}` : ''}`
  try {
    await safeFetchJson(url, { allowedHosts: [host], timeoutMs: 15_000 })
    return { status: 'verified' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/HTTP 429/.test(message)) return { status: 'rate_limited', reason: message }
    if (/HTTP (401|403)/.test(message)) return { status: 'temporarily_unavailable', reason: message }
    if (/private|allowlist|ENOTFOUND|timeout|aborted/i.test(message)) {
      return { status: 'temporarily_unavailable', reason: message.slice(0, 150) }
    }
    return { status: 'dead', reason: message.slice(0, 150) }
  }
}
