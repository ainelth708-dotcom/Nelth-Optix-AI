import { generateText, type LanguageModel } from 'ai'

/**
 * LLM-powered web-search routing for the OpenUI chat route.
 *
 * Replaces the deterministic regex detector: a small classification call
 * reads the latest user message plus a short window of recent turns and
 * decides whether the turn needs fresh web results before the assistant
 * answers — and, when it does, writes an effective (decontextualized) search
 * query. Search execution itself lives in the route; this module never
 * touches the stream.
 *
 * The perimeter of "needs a search" mirrors ChatGPT: volatile data (news,
 * prices, weather, scores, schedules), recency-critical facts (latest
 * versions, current roles, launches), verification asks and explicit web
 * requests get searched; explanations, code help, math, writing and small
 * talk are answered from knowledge.
 */

export const WEB_SEARCH_DECISION_TIMEOUT_MS = 8_000
/** The decision must stay cheap: a single JSON object is all we need. */
export const WEB_SEARCH_DECISION_MAX_TOKENS = 200

export const WEB_SEARCH_DECISION_PROMPT = `You are the web-search router of an AI assistant. Decide whether the assistant must gather FRESH information from a live web search before answering the user's latest message, or whether its existing knowledge already answers it correctly.

Judge the MEANING of the message, never the language: the user writes in French, English or Malagasy, sometimes mixing them.

SEARCH (needsSearch: true) when the correct answer DEPENDS on data that changed, is changing or is about to change:
1. Explicit web requests: search, look up, google, "cherche", "recherche", "trouve-moi en ligne", fetch, "site officiel", docs, download or pricing page, "donne-moi des sources".
2. News and current events: what just happened or is unfolding now — politics, conflicts, elections, disasters, sports results and standings, awards, showbusiness news, product news.
3. Volatile numbers and states: prices on any market (stocks, crypto, flights, shops), exchange rates, weather and forecasts, schedules and opening hours, stock availability, rankings, charts, ballot counts.
4. Recency-critical facts: the latest version of a software, app or model, releases, launches, "est-ce que c'est sorti", "le plus récent", the current holder of a role or title (CEO, champion, president), today's population or company figures, current line-ups and rosters.
5. Verification and sources: "est-ce vrai", "verify", "fact-check", rumors, surprising claims the user heard, requests for links or references.
6. Current state of a company, person, model or product the assistant could only half-know: current employer or role, recent signings, today's catalog or offer.

NO SEARCH (needsSearch: false) when the assistant already answers well without it:
1. Explanations, definitions, concepts, mechanisms, how things work, established science, history that is well settled, literature, language help.
2. Code: writing, explaining, refactoring or debugging code the user provides, language and library mechanics — unless the ask is about the current latest version.
3. Math, conversions, logic: compute, never search.
4. Creation: writing, rewriting, summarizing or translating text the user supplies, creative names, brainstorming, gift or baby-name ideas, plans (meal, training, trip, learning) when no live availability or price is involved.
5. Judgment and advice: opinions, "what should I choose" among stable options, recommendations from general knowledge.
6. Small talk and conversation-internal follow-ups: greetings, thanks, jokes, compliments, "continue", "pourquoi ?", "explique plus" — questions the running conversation itself already answers.

TIE-BREAKERS
- Resolve pronouns and ellipses with the recent conversation before judging ("et lui ?", "cette version" → the entity or version they designate).
- A famous entity used as the TOPIC of a timeless EXPLANATORY question with an explicit verb like "explique", "how", "what is", "qui est", "comment fonctionne", "définis" ("explique comment fonctionne Airbnb", "qui est Einstein") → NO.
- The same entity asked as a CURRENT STATE ("How many users does Airbnb have today?", "valeur nette Elon Musk", "où en est Elon Musk") → SEARCH.
- BARE ENTITY NAME with no verb ("Elon Musk", "Tesla", "Bitcoin", "Macron") → SEARCH. The user likely wants current status, net worth, latest news, or current role — not a static biography. Only treat as NO SEARCH if the conversation context clearly asks for a timeless explanation.
- Anything the user dates explicitly ("aujourd'hui", "cette année", "en ce moment", "as of now") → SEARCH.
- If the answer would still hold years from now unchanged → NO; if it could already be wrong since last month → SEARCH.
- When a balanced ask needs both knowledge and fresh data → SEARCH: the runner grounds the current part, and freshness must not break it.

OUTPUT — STRICT
Reply with ONE JSON object and nothing else — no prose, no code fence:
{"needsSearch": true, "query": "..."}  when a search is needed;
{"needsSearch": false, "query": ""}   when knowledge suffices.
The query: an effective web search query of 8 words or fewer, keywords rather than a sentence, written in the language that best serves the topic (the user's language by default, switching to English for technical or international topics), with pronouns and implicit references replaced by their referents so a stranger could type it into a search engine.`

export interface WebSearchDecisionTurn {
  role: 'user' | 'assistant' | 'system' | 'tool'
  text: string
}

export interface WebSearchDecision {
  /** Whether the turn needs fresh web results before it is answered. */
  needsSearch: boolean
  /** Effective search query; empty when no search is needed. */
  query: string
}

export interface DecideWebSearchParams {
  model: LanguageModel
  latestUserMessage: string
  recentTurns?: WebSearchDecisionTurn[]
  /** Overrides the default decision timeout (numbers are milliseconds). */
  timeoutMs?: number
  /** Callers forward the request signal so a gone client stops the call. */
  signal?: AbortSignal
}

/** Builds the user prompt the router sees: context turns, then the message. */
export function buildWebSearchDecisionInput(
  latestUserMessage: string,
  recentTurns: WebSearchDecisionTurn[] = []
): string {
  const lines: string[] = []
  if (recentTurns.length > 0) {
    lines.push('RECENT CONVERSATION (oldest first, most recent last):')
    for (const turn of recentTurns) {
      lines.push(
        `${
          turn.role === 'assistant' || turn.role === 'system'
            ? 'assistant'
            : 'user'
        }: ${turn.text}`
      )
    }
    lines.push('')
  }
  lines.push('LATEST USER MESSAGE:')
  lines.push(latestUserMessage)
  return lines.join('\n')
}

/**
 * Parses the router output: some models wrap JSON in prose or code fences, and
 * a strict-but-tolerant parse keeps a well-formed answer usable.
 */
export function parseWebSearchDecision(text: string): WebSearchDecision {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('The web-search decision contains no JSON object.')
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    needsSearch?: unknown
    query?: unknown
  }
  const flag = parsed.needsSearch
  return {
    needsSearch: flag === true || flag === 'true',
    query: typeof parsed.query === 'string' ? parsed.query.trim() : ''
  }
}

/**
 * One decision call: a tiny classification completion with a hard timeout.
 * Never networked elsewhere, never streamed, and failures are recoverable —
 * the caller simply answers from knowledge when this throws.
 */
export async function decideWebSearch({
  model,
  latestUserMessage,
  recentTurns = [],
  timeoutMs = WEB_SEARCH_DECISION_TIMEOUT_MS,
  signal
}: DecideWebSearchParams): Promise<WebSearchDecision> {
  const result = await generateText({
    model,
    system: WEB_SEARCH_DECISION_PROMPT,
    prompt: buildWebSearchDecisionInput(latestUserMessage, recentTurns),
    temperature: 0,
    maxOutputTokens: WEB_SEARCH_DECISION_MAX_TOKENS,
    // A router must be quick: one try, a hard timeout, and the caller falls
    // back to answering from knowledge when it fails.
    maxRetries: 0,
    timeout: timeoutMs,
    abortSignal: signal
  })
  return parseWebSearchDecision(result.text)
}
