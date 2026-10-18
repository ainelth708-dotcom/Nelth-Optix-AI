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

  it('scales answer depth from normal answers to ChatGPT-style detail', () => {
    expect(CONVERSATIONAL_BEHAVIOR).toContain(
      'normal, natural answers for simple questions'
    )
    expect(CONVERSATIONAL_BEHAVIOR).toContain(
      'detailed, ChatGPT-style answers for complex or open questions'
    )
  })

  it('uses concise text for greetings and reserves rich UI for suitable requests', () => {
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Pure greetings, thanks, acknowledgements, and casual small talk'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain('in plain Markdown text')
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Use a structured openui-lang page with relevant components when the user asks for a plan'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'Never use SearchImage as decoration'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'basic prompts keep the text-only format'
    )
  })

  it('keeps simple replies normal and makes deep questions detailed', () => {
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'a normal, complete reply to a simple question'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'detailed, ChatGPT-style answer'
    )
  })

  it('forbids the redundant closing Sources section on web-search answers', () => {
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'NEVER append a closing "Sources" section'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).toContain(
      'cite each supported claim inline with its exact [n] marker'
    )
    expect(OPENUI_RESPONSE_ROUTING_POLICY).not.toContain(
      'also end with a short "Sources" section'
    )
  })
})
