import {
  decideWebSearch,
  type WebSearchDecisionTurn
} from '@/lib/search/web-search-decision'
import { getTextFromParts } from '@/lib/utils/message-utils'
import { getModel } from '@/lib/utils/registry'

// Lightweight window of previous turns for the LLM search judge: plain text
// only, most recent last, never the full history. Same budget as the OpenUI
// chat route (6 turns × 700 chars) so the decision call stays cheap.
const JUDGE_CONTEXT_TURNS = 6
const JUDGE_CONTEXT_CHARS = 700

function buildJudgeTurns(history: readonly unknown[]): WebSearchDecisionTurn[] {
  return history
    .slice(0, -1) // the latest user message is passed separately
    .slice(-JUDGE_CONTEXT_TURNS)
    .map(m => {
      let text = ''
      try {
        text = getTextFromParts((m as { parts?: unknown }).parts as never)
      } catch {
        text = ''
      }
      return {
        role: ((m as { role?: string }).role ??
          'user') as WebSearchDecisionTurn['role'],
        text: text.slice(0, JUDGE_CONTEXT_CHARS)
      }
    })
    .filter(turn => turn.text.length > 0)
}

export interface SearchJudgeOutcome {
  /** TRUE when the turn needs fresh web results before it is answered. */
  needsSearch: boolean
  /** Judge-rewritten (decontextualized) search query; undefined when absent. */
  query?: string
}

// Hard wall-clock budget for the judge call. The judge must NEVER hold the
// stream hostage: a queued/slow model call is cut at 6 s and the turn is
// answered from knowledge (the old 8 s module timeout + 4 s race buffer
// left up to 12 s of total silence, long enough for clients to give up on
// the turn).
const JUDGE_HARD_BUDGET_MS = 3_500

/**
 * One LLM search-judge call with a hard wall-clock guard. Throws only when
 * the caller should answer from knowledge — the orchestrators catch and
 * continue WITHOUT a search (never a wildcard search, same contract as the
 * OpenUI chat route where this judge already runs in production).
 */
export async function runSearchJudge(params: {
  modelId: string
  latestUserMessage: string
  history: readonly unknown[]
  abortSignal?: AbortSignal
  logPrefix?: string
}): Promise<SearchJudgeOutcome> {
  const {
    modelId,
    latestUserMessage,
    history,
    abortSignal,
    logPrefix = '[Stream]'
  } = params
  const startedAt = Date.now()
  // Real cancellation: the AI SDK `timeout` option alone may be ignored by
  // the gateway, so the combined signal physically cuts the HTTP call at
  // the budget — either the request signal fires or the 6 s timer does.
  const judgeSignal = abortSignal
    ? AbortSignal.any([abortSignal, AbortSignal.timeout(JUDGE_HARD_BUDGET_MS)])
    : AbortSignal.timeout(JUDGE_HARD_BUDGET_MS)
  const decision = await Promise.race([
    decideWebSearch({
      model: getModel(modelId),
      latestUserMessage,
      recentTurns: buildJudgeTurns(history),
      timeoutMs: JUDGE_HARD_BUDGET_MS,
      signal: judgeSignal
    }),
    // Belt-and-suspenders: even if the model call itself hangs past its
    // internal timeout, the stream must keep moving.
    new Promise<null>(resolve =>
      setTimeout(() => resolve(null), JUDGE_HARD_BUDGET_MS + 500)
    )
  ])
  if (!decision) {
    console.warn(
      `${logPrefix} Search judge hard timeout — answering from knowledge`
    )
    return { needsSearch: false }
  }
  console.info(
    `${logPrefix} Search judge (LLM, ${Date.now() - startedAt}ms): ${
      decision.needsSearch ? 'SEARCH' : 'DIRECT'
    }` + (decision.query ? ` — query "${decision.query}"` : '')
  )
  return {
    needsSearch: decision.needsSearch,
    query: decision.query || undefined
  }
}
