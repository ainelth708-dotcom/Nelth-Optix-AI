import type { LanguageModel, ModelMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))

import { generateText } from 'ai'

import {
  buildSearchDecisionTranscript,
  decideWebSearch,
  isTimeSensitiveQuestion
} from '../search-decision'

const mockedGenerateText = vi.mocked(generateText)
const testModel = 'test:model' as unknown as LanguageModel

describe('buildSearchDecisionTranscript', () => {
  it('keeps the last six messages with role labels', () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index}`
    })) as ModelMessage[]

    const transcript = buildSearchDecisionTranscript(messages)

    expect(transcript).not.toContain('message 0')
    expect(transcript).not.toContain('message 1')
    expect(transcript).toContain('User: message 2')
    expect(transcript).toContain('Assistant: message 7')
  })

  it('truncates very long messages', () => {
    const transcript = buildSearchDecisionTranscript([
      { role: 'user', content: 'a'.repeat(700) }
    ] as ModelMessage[])

    expect(transcript.endsWith('…')).toBe(true)
    expect(transcript.length).toBeLessThan(660)
  })
})

describe('isTimeSensitiveQuestion', () => {
  it('forces the search for news-style questions', () => {
    expect(
      isTimeSensitiveQuestion(
        'Quelles sont les dernières infos sur Aashiqui 3 ?'
      )
    ).toBe(true)
    expect(
      isTimeSensitiveQuestion(
        'Aashiqui 3 : casting officiel, date de sortie confirmée, teaser'
      )
    ).toBe(true)
    expect(
      isTimeSensitiveQuestion('il fait quel temps demain ? la météo ?')
    ).toBe(true)
    expect(
      isTimeSensitiveQuestion('What is the latest news about Tesla?')
    ).toBe(true)
    expect(isTimeSensitiveQuestion('combien coûte le nouveau iPhone ?')).toBe(
      true
    )
  })

  it('leaves stable knowledge and creative turns to the classifier', () => {
    expect(isTimeSensitiveQuestion('Écris-moi un poème sur la mer')).toBe(false)
    expect(isTimeSensitiveQuestion('Explique-moi la photosynthèse')).toBe(false)
    expect(isTimeSensitiveQuestion('Corrige ce code TypeScript')).toBe(false)
    expect(isTimeSensitiveQuestion('')).toBe(false)
  })
})

describe('decideWebSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const messages = [
    { role: 'user', content: 'quelle est la météo à Paris ?' }
  ] as ModelMessage[]

  it('routes SEARCH verdicts to the web search pipeline', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'SEARCH' } as never)

    await expect(decideWebSearch({ model: testModel, messages })).resolves.toBe(
      true
    )
  })

  it('accepts a SEARCH verdict with trailing punctuation', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'search.' } as never)

    await expect(decideWebSearch({ model: testModel, messages })).resolves.toBe(
      true
    )
  })

  it('skips the search for DIRECT verdicts', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'DIRECT' } as never)

    await expect(decideWebSearch({ model: testModel, messages })).resolves.toBe(
      false
    )
  })

  it('answers without web search when the decision call fails', async () => {
    mockedGenerateText.mockRejectedValue(new Error('provider down'))

    await expect(decideWebSearch({ model: testModel, messages })).resolves.toBe(
      false
    )
  })
})
