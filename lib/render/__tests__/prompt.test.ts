import { describe, expect, test } from 'vitest'

import {
  getGenerativeUiPrompt,
  getImageSpecPrompt,
  getRelatedQuestionsSpecPrompt
} from '../prompt'

describe('render prompts', () => {
  test('uses OpenUI Lang follow-ups for substantive answers', () => {
    const prompt = getRelatedQuestionsSpecPrompt()

    expect(prompt).toContain('exactly 3 concise follow-up questions')
    expect(prompt).toContain('```openui')
    expect(prompt).toContain('FollowUpBlock([q1, q2, q3])')
    expect(prompt).toContain('Skip follow-ups for greetings')
    expect(prompt).not.toContain('```spec')
  })

  test('keeps image output compatible with the OpenUI image gallery', () => {
    expect(getImageSpecPrompt()).toContain('OpenUI ImageGallery')
    expect(getImageSpecPrompt()).not.toContain('Grid + Image')
  })

  test('uses the original OpenUI library and OpenUI Lang response format', () => {
    const prompt = getGenerativeUiPrompt()

    expect(prompt).toContain('```openui')
    expect(prompt).toContain('TravelMap')
    expect(prompt).toContain(
      'Never create or link a separate HTML file for these requests.'
    )
    expect(prompt).toContain('Table')
    expect(prompt).toContain('calculators, quizzes, planners, configurators')
    expect(prompt).toContain('prefer concise natural prose')
    expect(prompt).not.toContain('RFC 6902')
  })
})
