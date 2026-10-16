import { describe, expect, it } from 'vitest'

import {
  CONVERSATIONAL_BEHAVIOR,
  OPENUI_RESPONSE_ROUTING_POLICY
} from '../conversational-behavior'

describe('OpenUI conversational prompt policy', () => {
  it('keeps classic assistant continuity, tone, and language behavior', () => {
    expect(CONVERSATIONAL_BEHAVIOR).toContain(
      'Treat the conversation as one continuous thread'
    )
    expect(CONVERSATIONAL_BEHAVIOR).toContain(
      "Match the user's language and conversational style"
    )
    expect(CONVERSATIONAL_BEHAVIOR).toContain('reply briefly and warmly')
  })

  it('uses concise text for greetings and reserves rich UI for suitable requests', () => {
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Pure greetings, thanks, acknowledgements, and casual small talk'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain('root = Col([Text(')
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Use a structured page with relevant components when the user asks for a plan'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Never use SearchImage as decoration'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'All answers must still be valid openui-lang'
    )
  })
})
