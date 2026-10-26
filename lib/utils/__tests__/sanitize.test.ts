import { describe, expect, it } from 'vitest'

import {
  extractFakeSearchQuery,
  StreamTextSanitizer,
  stripFakeToolCallXml
} from '@/lib/utils/message-utils'

/** Streams `text` through a fresh sanitizer in chunks of `size`. */
function streamChunked(
  text: string,
  size: number,
  mode: 'classic' | 'openui' = 'classic'
): string {
  const sanitizer = new StreamTextSanitizer({ mode })
  let out = ''
  for (let i = 0; i < text.length; i += size) {
    out += sanitizer.process(text.slice(i, i + size))
  }
  out += sanitizer.flush()
  return out
}

/** Streams `text` through a fresh openui-mode sanitizer in word chunks. */
function streamWords(text: string): string {
  const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
  let out = ''
  for (const chunk of text.match(/\S+\s*/g) ?? [text]) {
    out += sanitizer.process(chunk)
  }
  out += sanitizer.flush()
  return out
}

const FAKE_CALL =
  '<dots_function_call>{"query":"iPhone 13 Pro"}</dots_function_call>'

describe('stripFakeToolCallXml', () => {
  it('strips closed fake tool blocks', () => {
    const text =
      'Answer start.\n<tool_call name="search">{"query":"x"}</tool_call>\nAnswer end.'
    const result = stripFakeToolCallXml(text)
    expect(result).toContain('Answer start.')
    expect(result).toContain('Answer end.')
    expect(result).not.toContain('tool_call')
  })

  it('strips an unclosed tool_call to the end (unambiguous fake syntax)', () => {
    const text = 'Answer start.\n<tool_call>{"query":"x"}'
    expect(stripFakeToolCallXml(text)).toBe('Answer start.')
  })

  it('strips <search"> fake tool call', () => {
    const text =
      '<search"> Mickael président Madagascar président de Madagascar actuel 2026\nVoici les faits.'
    const result = stripFakeToolCallXml(text)
    expect(result).not.toContain('search">')
    expect(result).not.toContain('Mickael président Madagascar')
    expect(result).toContain('Voici les faits.')
  })

  it('preserves legitimate prose mentioning <function>', () => {
    const text =
      'In JavaScript, the <function> keyword declares a reusable block of code.'
    expect(stripFakeToolCallXml(text)).toBe(text)
  })

  it('preserves an unclosed bare <invoke> tag in prose', () => {
    const text = 'Call <invoke> to run it and see what happens next.'
    expect(stripFakeToolCallXml(text)).toBe(text)
  })

  it('still strips attribute-carrying fake calls even when unclosed', () => {
    const text = 'Answer.\n<invoke name="search">{"query":"x"}'
    const result = stripFakeToolCallXml(text)
    expect(result).toBe('Answer.')
  })

  it('preserves spaces at chunk edges (no word gluing)', () => {
    expect(stripFakeToolCallXml('hello <br/> world')).toBe('hello <br/> world')
    expect(stripFakeToolCallXml(' leading and trailing ')).toBe(
      ' leading and trailing '
    )
  })
})

describe('extractFakeSearchQuery', () => {
  it('extracts query from <search"> format', () => {
    const text =
      '<search"> Mickael président Madagascar président de Madagascar actuel 2026\n'
    expect(extractFakeSearchQuery(text)).toBe(
      'Mickael président Madagascar président de Madagascar actuel 2026'
    )
  })

  it('extracts query from <search query="..."> format', () => {
    const text = '<search query="président actuel madagascar">'
    expect(extractFakeSearchQuery(text)).toBe('président actuel madagascar')
  })

  it('extracts query from <search>...</search> format', () => {
    const text = '<search>qui est le président de Madagascar</search>'
    expect(extractFakeSearchQuery(text)).toBe(
      'qui est le président de Madagascar'
    )
  })

  it('extracts query from <tool_call> format', () => {
    const text =
      '<tool_call>{"name":"search","arguments":{"query":"colonel mickael"}}</tool_call>'
    expect(extractFakeSearchQuery(text)).toBe('colonel mickael')
  })

  it('extracts query from JSON-style tool call', () => {
    const text = '{"name":"search","parameters":{"query":"colonel mickael"}}'
    expect(extractFakeSearchQuery(text)).toBe('colonel mickael')
  })

  it('returns null when no fake search exists', () => {
    expect(extractFakeSearchQuery('Bonjour tout le monde !')).toBeNull()
  })
})

describe('StreamTextSanitizer with <search">', () => {
  it('suppresses streaming of <search"> fake call', () => {
    const sanitizer = new StreamTextSanitizer()
    const chunk1 = sanitizer.process('<search')
    const chunk2 = sanitizer.process('"> Mickael president Madagascar')
    const remaining = sanitizer.flush()

    expect(chunk1).toBe('')
    expect(chunk2).toBe('')
    expect(remaining).not.toContain('<search')
  })
})

describe('StreamTextSanitizer fake function_call blocks', () => {
  it('suppresses a complete fake call in a single chunk', () => {
    expect(streamChunked(`Before ${FAKE_CALL} After.`, 500)).toBe(
      'Before  After.'
    )
  })

  it('suppresses the fake call split at every chunk boundary', () => {
    const text = `Avant. ${FAKE_CALL} Après.`
    for (const size of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const out = streamChunked(text, size)
      expect(out, `chunk size ${size}`).not.toContain('function_call')
      expect(out, `chunk size ${size}`).not.toContain('iPhone 13 Pro')
      expect(out, `chunk size ${size}`).toContain('Avant.')
      expect(out, `chunk size ${size}`).toContain('Après.')
    }
  })

  it('suppresses the fake call split on word chunks (realistic stream)', () => {
    const text =
      '<dots_function_call> iPhone 13 Pro date de sortie prix disponible </dots_function_call>The iPhone 13 Pro was released in September 2019.'
    const out = streamWords(text)
    expect(out).not.toContain('function_call')
    expect(out).not.toContain('date de sortie')
    expect(out).toContain('The iPhone 13 Pro was released in September 2019.')
  })

  it('handles the tag split between the open tag and its payload', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('<dots')
    out += sanitizer.process('_function_call>')
    out += sanitizer.process('{"query":"x"}')
    out += sanitizer.process('</dots')
    out += sanitizer.process('_function_call>')
    out += sanitizer.flush()
    expect(out).toBe('')
  })

  it('handles close tags split across chunks', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('<dots_function_call>')
    out += sanitizer.process('{"query":"x"}')
    out += sanitizer.process('</dots_func')
    out += sanitizer.process('tion_c')
    out += sanitizer.process('all>')
    out += sanitizer.process(' Visible now.')
    out += sanitizer.flush()
    expect(out).not.toContain('function_call')
    expect(out).toContain('Visible now.')
  })

  it('suppresses tool_call blocks (classic variant) across chunks', () => {
    const text =
      'Start. <tool_call name="search">{"query":"x"}</tool_call> End.'
    const out = streamChunked(text, 4)
    expect(out).not.toContain('tool_call')
    expect(out).not.toContain('"query"')
    expect(out).toContain('Start.')
    expect(out).toContain('End.')
  })

  it('suppresses multiple fake blocks in one response', () => {
    const text = [
      'Intro.',
      FAKE_CALL,
      'Middle.',
      '<tool_call>{"query":"y"}</tool_call>',
      'End.'
    ].join(' ')
    const out = streamChunked(text, 4)
    expect(out).not.toContain('function_call')
    expect(out).not.toContain('tool_call')
    expect(out).toContain('Intro.')
    expect(out).toContain('Middle.')
    expect(out).toContain('End.')
  })

  it('drops an unclosed fake block at end of stream (flush)', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('Bonjour. ')
    out += sanitizer.process('<dots_function_call>')
    out += sanitizer.process('{"query":"x"}')
    out += sanitizer.flush()
    expect(out).not.toContain('function_call')
    expect(out).not.toContain('"query"')
    expect(out).toContain('Bonjour.')
  })

  it('recovers when the model never closes the tag and streams prose after', () => {
    // Paragraph boundary = deterministic abandoned-tag signal: payload
    // dropped, prose after it released so the answer is never swallowed.
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('<dots_function_call> search: iphone')
    out += sanitizer.process('\n\nThe iPhone 13 Pro landed in September 2019.')
    out += sanitizer.flush()
    expect(out).not.toContain('<dots_function_call')
    expect(out).toContain('The iPhone 13 Pro landed in September 2019.')
  })

  it('keeps memory bounded on a pathological suppressed stream', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let last = ''
    for (let i = 0; i < 5000; i++) {
      last = sanitizer.process('x')
    }
    // Long past the cap: the machine releases instead of buffering forever.
    expect(last.length).toBeGreaterThan(0)
  })

  it('is isolated between consecutive and concurrent instances', () => {
    const first = new StreamTextSanitizer({ mode: 'openui' })
    const second = new StreamTextSanitizer({ mode: 'openui' })
    expect(first.process('<dots_function_call>')).toBe('')
    // The other sanitizer knows nothing about that open tag.
    expect(second.process('<dots_function_call>hello')).toBe('')
    expect(second.flush()).toBe('')
    expect(first.process('leak')).toBe('')
    expect(first.process('</dots_function_call>done')).toBe('done')
    expect(first.flush()).toBe('')
  })

  it('handles empty deltas and an empty stream', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    expect(sanitizer.process('')).toBe('')
    expect(sanitizer.flush()).toBe('')
  })
})

describe('StreamTextSanitizer Dots3 <|tool_calls_section_*> blocks', () => {
  const DOTS_SECTION =
    '<|tool_calls_section_begin|> GenerateMediaCard("image", "génère une image d\'Elon Musk") <|tool_calls_section_end|>'

  it('strips the whole closed <|tool_calls_section_*> block', () => {
    expect(streamChunked(`Avant ${DOTS_SECTION} Après.`, 500, 'openui')).toBe(
      'Avant  Après.'
    )
  })

  it('suppresses the section across every chunk boundary', () => {
    const text = `Avant. ${DOTS_SECTION} Après.`
    for (const size of [1, 2, 3, 7, 11, 23, 40]) {
      const out = streamChunked(text, size, 'openui')
      expect(out, `chunk size ${size}`).not.toContain('tool_calls_section')
      expect(out, `chunk size ${size}`).not.toContain('GenerateMediaCard')
      expect(out, `chunk size ${size}`).toContain('Avant.')
      expect(out, `chunk size ${size}`).toContain('Après.')
    }
  })

  it('suppresses the section split on word chunks', () => {
    const text =
      '<|tool_calls_section_begin|> GenerateMediaCard("image", "chat") <|tool_calls_section_end|>Voici ta génération.'
    const out = streamWords(text)
    expect(out).not.toContain('tool_calls_section')
    expect(out).not.toContain('GenerateMediaCard')
    expect(out).toContain('Voici ta génération.')
  })

  it('handles the open token split mid-stream', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('<|tool_calls_secti')
    out += sanitizer.process('on_begin|>')
    out += sanitizer.process('{"name":"GenerateMediaCard"}')
    out += sanitizer.process('<|tool_calls_section_end|>')
    out += sanitizer.process(' Liber.')
    out += sanitizer.flush()
    expect(out).toBe(' Liber.')
  })

  it('holds a partial <| marker instead of leaking it', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('Intro <|tool_cal')
    expect(out).not.toContain('<|tool_cal')
    out += sanitizer.process(
      'ls_section_begin|>payload<|tool_calls_section_end|> Fin'
    )
    out += sanitizer.flush()
    expect(out).toBe('Intro  Fin')
  })

  it('strips stray <|tool_call_*> markers in final output', () => {
    const text = '<|tool_calls_section_begin|>x<|tool_calls_section_end|>'
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process(text)
    expect(out).toBe('')
    out += sanitizer.flush()
    expect(out).not.toContain('tool_call')
  })
})

describe('StreamTextSanitizer OpenUI mode preserves legit content', () => {
  const PROGRAM = [
    '```openui',
    'root = <Col>',
    '  <SearchImage query="AI research" ratio={1.5}/>',
    '  <Title>Prix iPhone</Title>',
    '  <Markdown text="Chapitre" />',
    '  <Line path={[{ x: 1, y: 2 }]}/>',
    '  <Button>ToAssistant</Button>',
    '</Col>',
    '```'
  ].join('\n')

  it('leaves a valid openui program byte-identical through arbitrary chunks', () => {
    for (const size of [1, 2, 3, 5, 8, 13, 40, 97]) {
      expect(streamChunked(PROGRAM, size, 'openui')).toBe(PROGRAM)
    }
  })

  it('never triggers the classic search-tag cleanup on openui programs', () => {
    // A component that LOOKS search-like must not be line-stripped.
    expect(streamChunked('<SearchImage query="x"/>\n other', 3, 'openui')).toBe(
      '<SearchImage query="x"/>\n other'
    )
  })

  it('keeps openui streaming incremental for legit content', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    // PascalCase prefixes can never grow into a (lowercase) fake family, so
    // they stream out immediately: no unnecessary buffering of legit UI.
    expect(sanitizer.process('<Col')).toBe('<Col')
    expect(sanitizer.process('>')).toBe('>')
    expect(sanitizer.process(' <Title>Hello</Title>')).toBe(
      ' <Title>Hello</Title>'
    )
    // A lowercase partial prefix is held until it resolves, though — it may
    // still grow into a fake tool tag such as <dots_function_call>.
    const lowercase = new StreamTextSanitizer({ mode: 'openui' })
    expect(lowercase.process('<dot')).toBe('')
    expect(lowercase.process('s_function_call>')).toBe('')
  })

  it('releases lowercase wordish prose (URLs, arrows, hearts) unheld', () => {
    const sanitizer = new StreamTextSanitizer({ mode: 'openui' })
    let out = ''
    out += sanitizer.process('<http://example.com> and <3')
    out += sanitizer.flush()
    expect(out).toBe('<http://example.com> and <3')
  })

  it('still suppresses fake calls inside fenced openui programs', () => {
    const text = ['```openui', 'root = <Col>', FAKE_CALL, '</Col>', '```'].join(
      '\n'
    )
    const out = streamChunked(text, 5, 'openui')
    expect(out).not.toContain('function_call')
    expect(out).toContain('```openui')
  })
})
