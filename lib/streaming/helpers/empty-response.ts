/**
 * Silent-empty-response guard.
 *
 * When the weak model answers with ONLY fake `<tool_call>` XML, the
 * sanitizer strips all of it and the turn completes with zero text and zero
 * error — the client renders a blank bubble with no Retry affordance
 * (ChatError only shows when an error object exists). This helper decides
 * when to inject an honest, localized fallback line instead, so "no answer"
 * is always explainable and retryable. Exported for unit testing.
 *
 * The user's contract is "NEVER an empty bubble": the injection therefore
 * applies even when the request was aborted — if NOTHING was written before
 * the abort, the bubble would otherwise stay permanently blank (the abort
 * case itself delivers no partial text). Turns that already streamed real
 * text keep it untouched.
 */
export function shouldInjectEmptyFallback(args: {
  wroteContent: boolean
  wroteToolPart: boolean
  aborted: boolean
}): boolean {
  return !args.wroteContent
}

/**
 * Internal-retry gate: when an attempt streamed nothing at all (no text,
 * no tool parts — so no side effect could have run), the pipeline replays
 * the agent stream instead of giving up immediately. Bounded by the caller.
 * Exported for unit testing.
 */
export function shouldRetryEmptyAttempt(args: {
  hasContent: boolean
  hasTools: boolean
  attempt: number
  maxAttempts: number
  aborted: boolean
}): boolean {
  // If tools were already executed (e.g. generateImage, document, search),
  // NEVER retry the entire stream, which would cause duplicate tool executions.
  if (args.aborted || args.hasContent || args.hasTools) return false
  return args.attempt < args.maxAttempts
}

/**
 * Last-resort continuation line — used ONLY when even the internal retry
 * produced nothing. Per the product contract it must NEVER admit failure
 * ("désolé, je n'ai pas pu répondre") nor stay blank: it keeps the
 * conversation moving with a direct invitation to continue.
 */
export function emptyResponseText(lang: string | null | undefined): string {
  return lang === 'en'
    ? 'Sure! Tell me a bit more about what you would like to know or do, and I will answer right away.'
    : 'Très bien ! Dis-moi juste ce que tu aimerais savoir ou faire, et je te réponds tout de suite.'
}
