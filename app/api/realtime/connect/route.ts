import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UPSTREAM_REALTIME_URL = 'https://ace-studio-orcin.vercel.app/api/realtime/connect'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sdp, voice = 'cove', voice_mode = 'wingman', language_code = 'auto' } = body

    if (!sdp || typeof sdp !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid `sdp` (must start with v=0).' },
        { status: 400 }
      )
    }

    const upstreamRes = await fetch(UPSTREAM_REALTIME_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sdp,
        voice,
        voice_mode,
        language_code
      })
    })

    const data = await upstreamRes.json().catch(() => ({}))

    if (!upstreamRes.ok) {
      return NextResponse.json(
        data?.error ? data : { error: `Upstream error HTTP ${upstreamRes.status}` },
        {
          status: upstreamRes.status,
          headers: { 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[/api/realtime/connect] Error proxying connection:', err)
    return NextResponse.json(
      { error: `Proxy failed: ${message}` },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
