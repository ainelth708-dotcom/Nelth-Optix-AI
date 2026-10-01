import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UPSTREAM_URL = 'https://ace-studio-orcin.vercel.app/api/jwt/refresh'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
