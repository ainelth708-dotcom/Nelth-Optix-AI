import { describe, expect, it, vi } from 'vitest'

import { salvageProgram } from '@/components/openui/use-settled-opui-program'

import {
  minimalFallbackPage,
  repairOpenUIProgram,
  scanProgram,
  splitStatementsForSalvage
} from '../program-repair'

const VALID = `root = Col([
  Title("Comparatif"),
  Text("iPhone 15 vs Galaxy S24 [1](https://www.google.com)"),
  ListItem("Autonomie", "20% de mieux")
])`

describe('scanProgram', () => {
  it('finds no issues on a valid program', () => {
    const scan = scanProgram(VALID)
    expect(scan.issues).toEqual([])
    expect(scan.depth).toBe(0)
  })

  it('reports missing closers and statement starts', () => {
    const scan = scanProgram('root = Col([\n  Title("Hi")')
    expect(scan.depth).toBe(2)
    expect(scan.issues.filter(issue => issue.kind === 'open')).toHaveLength(2)
    expect(scan.statementStarts[0]?.name).toBe('root')
  })
})

describe('repairOpenUIProgram', () => {
  it('leaves a valid program untouched', () => {
    expect(repairOpenUIProgram(VALID)).toBe(VALID)
  })

  it('is idempotent', () => {
    const once = repairOpenUIProgram(VALID)
    expect(repairOpenUIProgram(once)).toBe(once)
  })

  it('balances brackets truncated at the tail', () => {
    expect(repairOpenUIProgram('root = Col([')).toBe('root = Col([])')
    expect(repairOpenUIProgram('root = Title("Hi"')).toBe('root = Title("Hi")')
  })

  it('drops extra closers beyond balance', () => {
    expect(repairOpenUIProgram('root = Col([]) )')).toBe('root = Col([])')
  })

  it('closes an unterminated string then balances', () => {
    expect(repairOpenUIProgram('root = Text("Bonjour')).toBe(
      'root = Text("Bonjour")'
    )
  })

  it('strips dangling commas before closers', () => {
    expect(repairOpenUIProgram('root = Col([Text("A"), ])')).toBe(
      'root = Col([Text("A")])'
    )
  })

  it('strips surrounding fence markers', () => {
    expect(repairOpenUIProgram('```openui\nroot = Col([])\n```')).toBe(
      'root = Col([])'
    )
  })

  it('normalizes curly quote artifacts', () => {
    expect(repairOpenUIProgram('root = Text(“Bonjour”)')).toBe(
      'root = Text("Bonjour")'
    )
  })

  it('preserves curly apostrophes inside strings (French typography)', () => {
    expect(repairOpenUIProgram("root = Text('L’article à lire')")).toBe(
      "root = Text('L’article à lire')"
    )
  })

  it('preserves `", )"` patterns inside string content', () => {
    expect(repairOpenUIProgram('root = Text("Salut, )")')).toBe(
      'root = Text("Salut, )")'
    )
  })

  it('repairs a trailing partially-fenced stream tail', () => {
    expect(repairOpenUIProgram('root = Col([])\n``')).toBe('root = Col([])')
  })
})

describe('splitStatementsForSalvage', () => {
  it('splits top-level statements including the first', () => {
    const chunks = splitStatementsForSalvage(
      'root = Col([])\nheader = Title("A")\nsummary = Text("B")'
    )
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toBe('root = Col([])')
    expect(chunks[2]).toBe('summary = Text("B")')
  })

  it('does not split inner indented property lines', () => {
    const chunks = splitStatementsForSalvage(
      'root = Col([\n  Title("A"),\n  Text("B")\n])'
    )
    expect(chunks).toHaveLength(1)
  })
})

describe('salvageProgram', () => {
  // Stub parser mirroring the lang-core Parser contract: a program fails to
  // produce a root when it still contains the CORRUPT marker.
  const stubParser = {
    parse: (program: string) => {
      const broken = !/^\s*root\s*=/.test(program) || /CORRUPT/.test(program)
      return {
        root: broken ? null : { type: 'element' },
        rootExpression: null,
        meta: { statementCount: broken ? 0 : 1, errors: [] }
      }
    }
  } as never

  it('returns the repaired program when it parses', () => {
    expect(salvageProgram('root = Col([', stubParser)).toBe('root = Col([])')
  })

  it('salvages the head when a tail statement stays corrupted', () => {
    const program = 'root = Col([Text("OK")])\nbad = Text("CORRUPT")'
    const result = salvageProgram(program, stubParser)
    expect(result).toBe('root = Col([Text("OK")])')
  })

  it('always yields something renderable (never blank)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = salvageProgram(')))(((', stubParser)
    expect(result).toBe(minimalFallbackPage())
    warn.mockRestore()
  })
})
