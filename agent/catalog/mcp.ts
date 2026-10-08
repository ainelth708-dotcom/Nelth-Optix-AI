import { assertPublicHttpsUrl } from '../fetch'

/**
 * MCP classification (§5): detect which catalogued MCP servers can REALLY be
 * consumed from serverless, vs which need an external host process.
 * - stdio / unknown transport, or no https endpoint → requiresExternalHost.
 * - http transport WITH an https endpoint → attempt a real Streamable-HTTP
 *   handshake (initialize → notifications/initialized → tools/list). Only a
 *   successful tools/list marks the server executable.
 * Nothing here spawns processes — Vercel-safe by construction.
 */

export type McpProbe =
  | { kind: 'executable'; endpoint: string; tools: string[] }
  | { kind: 'external'; reason: string }

function endpointOf(entry: {
  endpoint?: string
  documentationUrl?: string
}): string | null {
  const candidates = [entry.endpoint, entry.documentationUrl].filter(
    (u): u is string => !!u && /^https:\/\//i.test(u)
  )
  // Prefer an /mcp-ish endpoint; otherwise the docs URL is NOT callable.
  const mcpish = candidates.find(u => /\/mcp\/?(\?.*)?$/i.test(u))
  return mcpish ?? null
}

async function rpc(
  endpoint: string,
  host: string,
  body: Record<string, unknown>,
  sessionId?: string
): Promise<{ json: Record<string, unknown>; sessionId?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': 'Nelth-Agent-MCP-Probe/1.0'
  }
  if (sessionId) headers['mcp-session-id'] = sessionId
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), ...body }),
    signal: AbortSignal.timeout(15_000)
  })
  void host
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  // Streamable HTTP may answer SSE; extract the first JSON-RPC data payload.
  const match = text.match(/data:\s*(\{"jsonrpc"[\s\S]*?\})(?:\n|$)/)
  const json = JSON.parse((match?.[1] ?? text).trim()) as Record<string, unknown>
  return { json, sessionId: response.headers.get('mcp-session-id') ?? sessionId }
}

export async function probeMcpHttp(entry: {
  endpoint?: string
  documentationUrl?: string
}): Promise<McpProbe> {
  const endpoint = endpointOf(entry)
  if (!endpoint) {
    return { kind: 'external', reason: 'no callable https endpoint (docs/repo only)' }
  }
  let host: string
  try {
    host = await assertPublicHttpsUrl(endpoint, [new URL(endpoint).hostname])
  } catch (error) {
    return {
      kind: 'external',
      reason: (error instanceof Error ? error.message : 'blocked endpoint').slice(0, 150)
    }
  }
  try {
    const init = await rpc(
      endpoint,
      host,
      {
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'nelth-agent-probe', version: '1.0' }
        }
      }
    )
    const sessionId = init.sessionId
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {})
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }),
      signal: AbortSignal.timeout(15_000)
    }).catch(() => undefined)
    const tools = await rpc(
      endpoint,
      host,
      { method: 'tools/list', params: {} },
      sessionId
    )
    const result = tools.json.result as { tools?: Array<{ name?: string }> } | undefined
    const names = (result?.tools ?? [])
      .map(t => t.name)
      .filter((n): n is string => !!n)
      .slice(0, 50)
    if (!names.length) return { kind: 'external', reason: 'handshake ok but no tools listed' }
    return { kind: 'executable', endpoint, tools: names }
  } catch (error) {
    return {
      kind: 'external',
      reason: (error instanceof Error ? error.message : 'handshake failed').slice(0, 150)
    }
  }
}

export function classifyMcp(entry: {
  transport?: string
  endpoint?: string
  documentationUrl?: string
}): { requiresExternalHost: boolean; reason: string } {
  const transport = (entry.transport ?? 'unknown').toLowerCase()
  if (transport === 'stdio') {
    return { requiresExternalHost: true, reason: 'stdio transport needs a host process' }
  }
  if (!endpointOf(entry)) {
    return { requiresExternalHost: true, reason: 'no callable https endpoint known' }
  }
  return { requiresExternalHost: false, reason: 'http endpoint candidate — probe to confirm' }
}
