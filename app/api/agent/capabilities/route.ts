import { NextResponse } from 'next/server'

import { getCapabilities } from '@/lib/agent/worker/capabilities'

export const maxDuration = 30

// Single source of truth, served live — the UI never hardcodes these.
export async function GET() {
  return NextResponse.json({ success: true, capabilities: getCapabilities() })
}
