import { describe, expect, test } from 'vitest'

import { isOpenUILangResponse } from '@/lib/openui/content-format'

describe('isOpenUILangResponse', () => {
  test('detects fenced OpenUI programs', () => {
    expect(
      isOpenUILangResponse('```openui\nroot = Col([Text("Hi")])\n```')
    ).toBe(true)
  })

  test('detects bare OpenUI programs starting at the root entry point', () => {
    expect(
      isOpenUILangResponse('root = Col([header])\nheader = Title("Hello")')
    ).toBe(true)
  })

  test('treats greetings and plain prose as Markdown text', () => {
    expect(
      isOpenUILangResponse('Bonjour ! Que puis-je faire pour vous ?')
    ).toBe(false)
    expect(
      isOpenUILangResponse(
        '## Comparatif\n\nVoici les points clés :\n\n- prix\n- qualité'
      )
    ).toBe(false)
  })

  test('treats empty content as Markdown text', () => {
    expect(isOpenUILangResponse('')).toBe(false)
    expect(isOpenUILangResponse('   \n  ')).toBe(false)
  })

  test('does not mistake prose mentioning root for a program', () => {
    expect(
      isOpenUILangResponse('The root cause of the issue is unknown.')
    ).toBe(false)
  })
})
