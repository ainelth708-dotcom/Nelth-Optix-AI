'use client'

import { useMemo } from 'react'

import { createParser } from '@openuidev/react-lang'

import {
  minimalFallbackPage,
  repairOpenUIProgram,
  scanProgram,
  splitStatementsForSalvage
} from '@/lib/openui/program-repair'

import { useThrottledStreamValue } from './use-throttled-stream-value'

type RepairLibrary = {
  root?: string | null
  toJSONSchema: () => unknown
}

type ProgramParser = ReturnType<typeof createParser>

type ParseOutcome = {
  root: unknown | null
  rootExpression: unknown | null
  meta: { statementCount: number }
}

/**
 * Parse the (already repaired) program with the real Lang parser and report
 * whether it yields a renderable result. `root` is null for pages whose
 * `root =` picks a component at runtime (`root = $mode ? A : B`) — the
 * `rootExpression` node then carries the decision, so it also counts.
 */
function parseOutcome(
  parser: ProgramParser | null,
  program: string
): ParseOutcome | null {
  if (!parser) return null
  try {
    const result = parser.parse(program)
    const meta = result.meta as { statementCount?: number }
    return {
      root: result.root ?? null,
      rootExpression: result.rootExpression ?? null,
      meta: { statementCount: meta.statementCount ?? 0 }
    }
  } catch {
    return {
      root: null,
      rootExpression: null,
      meta: { statementCount: 0 }
    }
  }
}

const isRenderable = (outcome: ParseOutcome | null): boolean =>
  !!outcome && (outcome.root !== null || outcome.rootExpression !== null)

// Same as React keys: a bounded ladder protects against pathological inputs.
const MAX_SALVAGE_ATTEMPTS = 24

/**
 * Salvage ladder — LAST line of defense for a corrupted program:
 *   1. plain repair (bracket/template/comment aware)
 *   2. statement salvage — drop corrupted tail statements one by one and keep
 *      the longest still-renderable head
 *   3. synthesized minimal page (guaranteed valid)
 *
 * User-visible contract: the page renders — never blank, never raw source.
 */
export function salvageProgram(
  program: string,
  parser: ProgramParser | null
): string {
  const repaired = repairOpenUIProgram(program)
  if (isRenderable(parseOutcome(parser, repaired))) return repaired

  const statements = splitStatementsForSalvage(program)
  let attempts = 0
  for (
    let keep = statements.length - 1;
    keep >= 1 && attempts < MAX_SALVAGE_ATTEMPTS;
    keep--
  ) {
    attempts += 1
    const candidate = repairOpenUIProgram(statements.slice(0, keep).join('\n'))
    if (candidate.length === 0) continue
    if (isRenderable(parseOutcome(parser, candidate))) return candidate
  }

  // Nothing parseable — guarantee a page anyway.
  console.warn(
    '[openui] program could not be salvaged — showing the minimal fallback page'
  )
  return minimalFallbackPage()
}

/**
 * Feeds the Renderer a stream-throttled value during streaming, and the
 * repaired-or-salvaged program once the stream settles. The final contract:
 * always a page, never a blank frame.
 */
export function useSettledOpenUIProgram(
  response: string,
  isStreaming: boolean,
  library: RepairLibrary
): string {
  const parser = useMemo(
    () =>
      createParser(
        library.toJSONSchema() as Parameters<typeof createParser>[0],
        library.root ?? undefined
      ),
    [library]
  )
  const raw = useThrottledStreamValue(response, isStreaming)
  return useMemo(() => {
    if (isStreaming) return raw
    return salvageProgram(raw, parser)
  }, [isStreaming, parser, raw])
}
