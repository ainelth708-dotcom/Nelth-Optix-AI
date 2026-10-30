/**
 * Hybrid Routing Strategy combining deterministic TypeScript rules with LLM Search Judge.
 * Conforms to Section 4 of the Performance Optimization Specification.
 */

import { needsFactVerification } from '@/lib/conversation/factual-gate'
import {
  DOCUMENT_INTENT_RE,
  hasExplicitFreshSignal,
  IMAGE_INTENT_RE,
  isStandaloneEntityLookup
} from '@/lib/skills/capability-detection'
import { foldText, intentRe } from '@/lib/skills/text-fold'
import { runSearchJudge, type SearchJudgeOutcome } from '@/lib/streaming/helpers/search-judge'
import { isAffirmativeContinuation } from '@/lib/conversation/conversation-state'
import {
  isGreetingLike,
  isIdentityQuery,
  isPureGreeting
} from '@/lib/utils/message-utils'

const WEB_SEARCH_VERB_RE = intentRe(
  'cherche|recherche|search|trouve|find|google|regarde\\s+sur\\s+(le\\s+web|internet)|fetch|look\\s*up|donne[\\s-]moi\\s+des\\s+sources'
)

const MATH_OR_CODE_RE = intentRe(
  'calcule|calculer|combien\\s+font|combien\\s+fait|\\d+\\s*[\\+\\-\\*\\/x\\^]\\s*\\d+|equation|integrale|derivee|theoreme|code|coder|fonction|function|script|programme|algorithme|javascript|typescript|python|html|css|react|sql|regex'
)

const LINGUISTIC_OR_CREATIVE_RE = intentRe(
  'traduis|traduire|traduction|translate|translation|corrige|corriger|correction|orthographe|grammaire|reformule|reformuler|poeme|poesie|histoire|raconte|blague|joke|paraphrase|dissertation|redige|rediger'
)

const CONVERSATIONAL_CHITCHAT_RE = intentRe(
  'bonjour|salut|coucou|hello|hi|hey|yo|salama|manao\\s+ahoana|ca\\s+va|comment\\s+ca\\s+va|merci|thanks|ok|okay|d[’\']?accord|super|cool|bienvenue|au\\s+revoir|bye|a\\s+demain|bonne\\s+nuit|bonne\\s+journee|parfait|nickel|top|merci\\s+beaucoup|thank\\s+you'
)

const EXPLANATION_OR_CONCEPT_RE = intentRe(
  'pourquoi|comment|how|why|explique|expliquer|qu[’\']?est[-\\s]ce\\s+(que?|qui)|c[’\']?est\\s+quoi|definition'
)

const CURRENT_INFO_KEYWORDS_RE = intentRe(
  'actualites?|news|prix|price|prices|meteo|weather|score|match|resultats?|classement|gagnant|vainqueur|evenements?|2026|president|premier\\s+ministre|gouvernement|election|dirigeant|bourse|action|actions|crypto|bitcoin|inflation|taux|monnaie'
)

export type DeterministicRouteDecision =
  | { type: 'deterministic'; route: 'direct'; needsSearch: false }
  | { type: 'deterministic'; route: 'search'; needsSearch: true; query?: string }
  | { type: 'deterministic'; route: 'connector'; needsSearch: false }
  | { type: 'deterministic'; route: 'image'; needsSearch: false }
  | { type: 'deterministic'; route: 'document'; needsSearch: false }
  | { type: 'ambiguous' }

/**
 * Deterministically classifies obvious user turns without invoking an LLM.
 * Saves 1000ms-6000ms of latency for greetings, explanations, math, translations,
 * and straightforward search/connector tasks.
 */
export function evaluateDeterministicRoute(params: {
  query: string
  hasAttachments?: boolean
  connectorIntent?: boolean
  needsImage?: boolean
  needsDocument?: boolean
  isIdentityTurn?: boolean
  isFounderPhoto?: boolean
  searchMode?: string
}): DeterministicRouteDecision {
  const {
    query,
    hasAttachments = false,
    connectorIntent = false,
    needsImage = false,
    needsDocument = false,
    isIdentityTurn = false,
    isFounderPhoto = false,
    searchMode = 'quick'
  } = params

  const trimmed = (query ?? '').trim()
  if (!trimmed) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  const qf = foldText(trimmed)

  // 1. Identity / Founder queries -> Direct (internal knowledge)
  if (isIdentityTurn || isIdentityQuery(trimmed) || isFounderPhoto) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  // 2. Adaptive mode explicitly forces deep search
  if (searchMode === 'adaptive') {
    return { type: 'deterministic', route: 'search', needsSearch: true }
  }

  // 3. User account data -> Connector
  if (connectorIntent) {
    return { type: 'deterministic', route: 'connector', needsSearch: false }
  }

  // 4. Document / file analysis
  if (needsDocument || hasAttachments || DOCUMENT_INTENT_RE.test(qf)) {
    return { type: 'deterministic', route: 'document', needsSearch: false }
  }

  // 5. Image generation
  if (needsImage || IMAGE_INTENT_RE.test(qf)) {
    return { type: 'deterministic', route: 'image', needsSearch: false }
  }

  // 6. Explicit web search requests -> Search
  if (WEB_SEARCH_VERB_RE.test(qf)) {
    return { type: 'deterministic', route: 'search', needsSearch: true }
  }

  // 7. Explicit freshness markers (now, today, weather, live scores) -> Search
  if (hasExplicitFreshSignal(trimmed) || CURRENT_INFO_KEYWORDS_RE.test(qf)) {
    return { type: 'deterministic', route: 'search', needsSearch: true }
  }

  // 8. Fact-verification gate (prices, quotas, trials, etc.) -> Search
  if (needsFactVerification(trimmed)) {
    return { type: 'deterministic', route: 'search', needsSearch: true }
  }

  // 9. Standalone entity lookups (e.g. "DeepSeek R1", "Colonel Mickael") -> Search
  if (isStandaloneEntityLookup(trimmed)) {
    return { type: 'deterministic', route: 'search', needsSearch: true }
  }

  // 10. Greetings, chit-chat, thanks, and affirmatives -> Direct
  if (
    isPureGreeting(trimmed) ||
    isGreetingLike(trimmed) ||
    CONVERSATIONAL_CHITCHAT_RE.test(qf) ||
    isAffirmativeContinuation(trimmed)
  ) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  // 11. Math, calculations, logic -> Direct
  if (MATH_OR_CODE_RE.test(qf)) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  // 12. Translation, rewriting, grammar correction, creative writing -> Direct
  if (LINGUISTIC_OR_CREATIVE_RE.test(qf)) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  // 13. Timeless explanations / definitions with no freshness signals -> Direct
  if (EXPLANATION_OR_CONCEPT_RE.test(qf)) {
    return { type: 'deterministic', route: 'direct', needsSearch: false }
  }

  // Turn is ambiguous: delegate to LLM search judge
  return { type: 'ambiguous' }
}

export interface HybridRouteResult {
  route: 'direct' | 'search' | 'connector' | 'image' | 'document' | 'agent'
  needsSearch: boolean
  searchQuery?: string
  wasDeterministic: boolean
  decisionDurationMs: number
}

/**
 * Hybrid route resolver: executes deterministic classification first.
 * If ambiguous, invokes runSearchJudge with safety timeout.
 */
export async function resolveHybridRoute(params: {
  query: string
  modelId: string
  history?: readonly unknown[]
  abortSignal?: AbortSignal
  hasAttachments?: boolean
  connectorIntent?: boolean
  needsImage?: boolean
  needsDocument?: boolean
  isIdentityTurn?: boolean
  isFounderPhoto?: boolean
  searchMode?: string
  logPrefix?: string
}): Promise<HybridRouteResult> {
  const startTime = performance.now()
  const {
    query,
    modelId,
    history = [],
    abortSignal,
    hasAttachments,
    connectorIntent,
    needsImage,
    needsDocument,
    isIdentityTurn,
    isFounderPhoto,
    searchMode,
    logPrefix = '[Router]'
  } = params

  const deterministic = evaluateDeterministicRoute({
    query,
    hasAttachments,
    connectorIntent,
    needsImage,
    needsDocument,
    isIdentityTurn,
    isFounderPhoto,
    searchMode
  })

  if (deterministic.type === 'deterministic') {
    const duration = performance.now() - startTime
    console.info(
      `${logPrefix} Deterministic route (${duration.toFixed(2)}ms): ${deterministic.route.toUpperCase()} (needsSearch=${deterministic.needsSearch})`
    )
    return {
      route: deterministic.route,
      needsSearch: deterministic.needsSearch,
      searchQuery: deterministic.route === 'search' ? deterministic.query : undefined,
      wasDeterministic: true,
      decisionDurationMs: duration
    }
  }

  // Ambiguous case: invoke the LLM search judge
  try {
    const outcome: SearchJudgeOutcome = await runSearchJudge({
      modelId,
      latestUserMessage: query,
      history,
      abortSignal,
      logPrefix
    })

    const duration = performance.now() - startTime
    return {
      route: outcome.needsSearch ? 'search' : 'direct',
      needsSearch: outcome.needsSearch,
      searchQuery: outcome.query,
      wasDeterministic: false,
      decisionDurationMs: duration
    }
  } catch (error) {
    const duration = performance.now() - startTime
    console.warn(
      `${logPrefix} Search judge failed or timed out (${duration.toFixed(2)}ms) — falling back to direct:`,
      error instanceof Error ? error.message : error
    )
    return {
      route: 'direct',
      needsSearch: false,
      wasDeterministic: false,
      decisionDurationMs: duration
    }
  }
}
