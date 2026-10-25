'use client'

import { useEffect, useState } from 'react'

// How often a streaming value may visibly update while a message streams.
// The OpenUI Lang Renderer re-parses the whole program and re-evaluates the
// whole tree on every response change, so word-level deltas (~30/s) triggered
// a full parse + React re-render that often — the main source of jank while a
// rich page streams. ~2.5 updates/s stays smooth without decisively changing
// the perceived typing speed.
const STREAM_UI_THROTTLE_MS = 400

type ThrottleState = {
  /** Value the consumer may currently render. */
  throttled: string
  /** Timestamp of the last throttled push (0 = base was just reset / restart). */
  lastPushAt: number
  /** Whether the previous render was streaming. */
  wasStreaming: boolean
}

/**
 * Feeds an expensive consumer (the OpenUI Renderer) a value that updates at
 * most every `throttleMs` while the message streams. The FINAL value is always
 * resolved immediately when the stream stops, so the settled page is complete.
 *
 * Render-time work stays pure: transitions are derived with guarded state
 * updates (the React-recommended "adjust state on prop change" pattern), and
 * the clock lives exclusively in the timer effect.
 */
export function useThrottledStreamValue(
  value: string,
  isStreaming: boolean,
  throttleMs: number = STREAM_UI_THROTTLE_MS
): string {
  const [state, setState] = useState<ThrottleState>({
    throttled: value,
    lastPushAt: 0,
    wasStreaming: !isStreaming
  })

  let shown = state.throttled
  if (!isStreaming) {
    // Settled: always expose the latest value and reset the throttle clock.
    if (state.throttled !== value || state.wasStreaming) {
      setState({ throttled: value, lastPushAt: 0, wasStreaming: false })
    }
    shown = value
  } else if (!state.wasStreaming) {
    // Stream just (re)started: paint the fresh value now; the effect below
    // schedules a 0-delay push which starts the throttle clock from here.
    setState({ throttled: value, lastPushAt: 0, wasStreaming: true })
    shown = value
  }

  useEffect(() => {
    if (!isStreaming) return
    const elapsed = Date.now() - state.lastPushAt
    const remaining = elapsed >= throttleMs ? 0 : throttleMs - elapsed
    const timer = setTimeout(() => {
      // Bail out when the value is already shown — this keeps long streaming
      // pauses (no new deltas) from re-rendering every throttle tick.
      setState(prev =>
        prev.wasStreaming && prev.throttled === value
          ? prev
          : {
              throttled: value,
              lastPushAt: Date.now(),
              wasStreaming: true
            }
      )
    }, remaining)
    return () => clearTimeout(timer)
  }, [value, isStreaming, throttleMs, state.lastPushAt])

  return shown
}
