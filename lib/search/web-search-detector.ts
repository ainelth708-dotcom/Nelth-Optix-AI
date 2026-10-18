import { foldText } from '@/lib/skills/text-fold'
import { isPureGreeting } from '@/lib/utils/message-utils'

/**
 * Deterministic, lightweight web-search intent detector.
 *
 * Replaces the former LLM classifier on the OpenUI chat route: a weighted,
 * multilingual (French / English / Malagasy + mixed) rule set scores the user
 * message and decides whether the turn needs fresh web results before the
 * model answers. No LLM call, no network, no I/O — precompiled regexes and
 * pure functions only.
 *
 * Patterns are written FOLDED (lowercase, no diacritics, `'` apostrophes) and
 * tested against `foldText()` output, so accents never change the verdict.
 *
 * Decision: `needsWebSearch = score >= WEB_SEARCH_SCORE_THRESHOLD`, with two
 * overrides:
 * - an explicit search request (a +100 rule) wins over negative signals,
 *   unless the user explicitly asked not to search;
 * - "local task" negatives (explain this, fix this code, continue) are
 *   ignored when a strong external-information signal (>= +70) matched.
 */

export interface WebSearchDetectorContext {
  /**
   * A limited window of previous turns (plain text, oldest first, most recent
   * last). Used only to recognise follow-ups that can be answered from the
   * conversation; never load the full history here.
   */
  recentTurns?: string[]
}

export interface WebSearchDetection {
  needsWebSearch: boolean
  score: number
  reason: string
  matchedRules: string[]
}

interface DetectorInput {
  raw: string
  normalized: string
  context?: WebSearchDetectorContext
}

interface DetectorRule {
  id: string
  weight: number
  /** Skipped when a strong external-information signal (>= +70) matched. */
  suppressedByStrongSignal?: boolean
  test: (input: DetectorInput) => boolean
}

/** Single source of truth for rule weights and the decision threshold. */
export const WEB_SEARCH_DETECTOR_WEIGHTS = {
  explicitSearchRequest: 100,
  newsRecentEvents: 90,
  verifyExternalSource: 90,
  pricesWeatherRates: 85,
  findOnlineProjects: 80,
  latestVersion: 80,
  officialDocs: 70,
  externalCitations: 50,
  compareProductsServices: 45,
  changingFacts: 35,
  greetingChitchat: -100,
  translationRewriting: -100,
  simpleArithmetic: -80,
  creativeRequest: -80,
  stableKnowledge: -60,
  selfContainedCode: -60,
  followUpContext: -50
} as const

export const WEB_SEARCH_SCORE_THRESHOLD = 60

const STRONG_SIGNAL_WEIGHT = 70

function normalize(message: string): string {
  return foldText(message)
    .replace(/[\u2018\u2019\u02bc\u201b\u2032`´]/g, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const SEARCH_VERBS =
  'cherche|cherches|cherchez|chercher|recherche|recherches|recherchez|rechercher|trouve|trouves|trouvez|trouver|search|find|google|look up|tadiavo|karohy|mitady|jereo'

const WEB_TARGETS =
  "web|internet|google|github|gitlab|en ligne|online|sur le net|le net|amin'ny web|amin'ny aterineto|amin'ny internet|ao amin'ny web"

const WEB_TARGET_RE = new RegExp(WEB_TARGETS)

const EXPLICIT_SEARCH_RE = new RegExp(
  [
    `\\b(?:${SEARCH_VERBS})\\b[^.!?\\n]{0,60}\\b(?:${WEB_TARGETS})\\b`,
    `\\b(?:${WEB_TARGETS})\\b[^.!?\\n]{0,40}\\b(?:${SEARCH_VERBS})\\b`,
    '\\bfais[- ]?(?:moi )?une recherche\\b',
    '\\bgoogle (?:it|le|la|ca|cela)\\b',
    '\\blook it up\\b',
    `^(?:peux[- ]tu |pourrais[- ]tu |peut[- ]tu |can you |could you |please )?(?:${SEARCH_VERBS})\\b`
  ].join('|')
)

const NEWS_RE = new RegExp(
  [
    "\\b(?:actualites?|actus?|news|headlines|vaovao|nouveautes?|nouvelles du jour|derniere heure|dernieres? (?:infos|informations|nouvelles)|infos? (?:recentes?|du jour)|quoi de neuf|what's new|whats new|breaking news)\\b",
    "\\b(?:aujourd'hui|today|androany|hier|yesterday|omaly|ce matin|ce soir|cette semaine|this week)\\b[^.!?\\n]{0,60}\\b(?:se passe|passe-t-il|passe t il|happening|events?|evenements?|info|news|actualite|nouveaute|new|sortie|sort|annonce|vaovao|resultat|score)\\b",
    "\\b(?:se passe|passe-t-il|passe t il|il se passe|happening)\\b[^.!?\\n]{0,60}\\b(?:aujourd'hui|today|androany|maintenant|now|ce matin|ce soir|cette semaine)\\b",
    '\\b(?:nouveau|nouvel|nouveaux|nouvelle|nouvelles|new|latest|dernier|derniere)\\s+(?:president|presidente|maire|ceo|pdg|premier ministre|prime minister|gouvernement|government|champion|championne|vainqueur|gagnant|record|pape)\\b',
    '\\b(?:casting|bande[- ]annonce|teaser|trailer|date de sortie|release date|sortie (?:au cinema|prevue|confirmee))\\b',
    "\\b(?:score (?:du match|final)|resultats? (?:du match|de l'election|des elections)|elections? (?:de |du |presidentielles? )?20\\d\\d|en direct|live)\\b"
  ].join('|')
)

const VERIFY_RE = new RegExp(
  [
    '\\b(?:verifie|verifies|verifiez|verifier|valide|valider|validate|confirme|confirmer|confirm|fact[- ]?check|hamarino)\\b[^.!?\\n]{0,60}\\b(?:source|sources|repo|repository|licence|license|url|lien|liens|link|links|information|cette info|document|site|page|article|projet|project|documentation|api|pdf|depeche|claim|affirmation|fait)\\b',
    '\\b(?:check|verify)\\b[^.!?\\n]{0,60}\\b(?:source|sources|repo|repository|license|url|link|links|information|document|site|page|article|project|documentation|api|maintained|still)\\b',
    '\\b(?:encore|toujours|still|mbola)\\s+(?:maintenu\\w*|maintained|supporte\\w*|supported|actif|active|a jour|up to date|valable|valide|relevant|pertinent|en ligne|available|disponible|en vie|velona|misy|mandeha)\\b'
  ].join('|')
)

const VERIFY_CLAIM_RE =
  /\b(?:is (?:it|this|that) (?:true|correct|accurate)|est[- ]?ce (?:vrai|exact|correct)|vrai ou faux|c'est (?:vrai|exact) que)\b/

const PRICES_WEATHER_RE = new RegExp(
  [
    '\\b(?:prix|price|prices|precio|vidy|vidiny|tarif|tarifs|couts?|cost|costs)\\b',
    '\\bcombien (?:coute|coute-t|coute-t-il|coute-t-elle|coutent|ca coute|cela coute)\\b',
    '\\bhow much (?:is|are|does|do|did|cost|costs)\\b',
    "\\b(?:meteo|weather|forecast|previsions?|temperature|temperatures|toetrandro|toetr'andro|quel temps)\\b",
    "\\b(?:taux de change|exchange rate|cours (?:de l'action|de la bourse|du bitcoin|de l'or|du dollar|de l'euro|des actions|du petrole|de la crypto)|stock price)\\b",
    '\\b(?:disponibilite|availability|en stock|in stock)\\b',
    '\\b(?:est|sont|sera|seront|quand|when|is|are|will)\\b[^.!?\\n]{0,40}\\b(?:disponible|disponibles|available|dispo)\\b',
    "\\bis it free\\b|\\best[- ]?ce (?:que c'est )?gratuit\\b"
  ].join('|')
)

const FIND_VERBS =
  'trouve|trouves|trouvez|trouver|cherche|cherches|cherchez|chercher|recherche|recherches|recherchez|rechercher|find|search|recommande|recommandes|recommander|recommend|suggest|suggere|suggerer|liste|list|compare|compares|comparent|comparer|donne|donnez|give|montre|montrez|show|meilleur|meilleure|meilleurs|meilleures|best'

const ONLINE_OBJECTS =
  'api|apis|librairie|librairies|bibliotheque|bibliotheques|library|libraries|framework|frameworks|package|packages|outil|outils|tool|tools|service|services|plateforme|plateformes|platform|platforms|projet|projets|project|projects|open[- ]?source|github|npm|pip|pypi|crate|crates|module|modules|app|apps|application|applications|logiciel|logiciels|software|bot|bots|plugin|plugins|dataset|datasets|alternatives?|concurrents?|competiteurs?|sdk'

const FIND_ONLINE_RE = new RegExp(
  [
    `\\b(?:${FIND_VERBS})\\b[^.!?\\n]{0,60}\\b(?:${ONLINE_OBJECTS})\\b`,
    `\\b(?:${ONLINE_OBJECTS})\\b[^.!?\\n]{0,40}\\b(?:${FIND_VERBS})\\b`
  ].join('|')
)

const LATEST_VERSION_RE = new RegExp(
  [
    '\\b(?:derniere|dernier|derniers|dernieres|latest|newest|current|actuel|actuelle|actuels|actuelles|nouveau|nouvel|nouveaux|nouvelle|nouvelles)\\s+(?:version|versions|release|releases|mise a jour|mises a jour|update|updates|modele|modeles|model|models|edition|editions|sortie|sorties)\\b',
    '\\b(?:version|versions|release|mise a jour|update|modele|model)\\b[^.!?\\n]{0,25}\\b(?:actuelle?|actuels|actuelles|recente?s?|derniere?s?|latest|newest)\\b',
    '\\b(?:mise a jour|update)\\b',
    "\\bwhat's the latest\\b|\\bwhats the latest\\b",
    '\\bquelle (?:est la )?(?:derniere|nouvelle|plus recente) version\\b',
    '\\bversion (?:vaovao|farany)\\b'
  ].join('|')
)

const OFFICIAL_DOCS_RE = new RegExp(
  [
    '\\b(?:documentation|docs?|doc)\\b[^.!?\\n]{0,30}\\b(?:officielle|officielles|officiel|officiels|official|actuelle|actuels|actuelles|actuel|a jour|recente|recentes|recent|current|latest|nouvelle)\\b',
    '\\b(?:official|current|latest) (?:documentation|docs)\\b',
    "\\bapi reference\\b|\\breference (?:de l'api|d'api|api)\\b|\\bdocumentation (?:de l'api|d'api|api)\\b"
  ].join('|')
)

const EXTERNAL_CITATIONS_RE = new RegExp(
  [
    '\\b(?:donne[- ]moi|donne|donnez|give me|give|cite|citez|cite-moi|avec|with|ajoute|ajoutez|add|montre|montrez|show|fournis|fournissez|provide|include|besoin de|need|veux|want)\\b[^.!?\\n]{0,40}\\b(?:sources?|references?|citations?|liens?|links?|bibliographie|bibliography)\\b',
    '\\b(?:sources?|references?|citations?)\\s+(?:fiables?|credibles?|officielles?|reliable|credible|official)\\b'
  ].join('|')
)

const COMPARE_VERBS =
  'compare|compares|comparent|comparer|comparaison|comparatif|versus|meilleur|meilleure|meilleurs|meilleures|best|better between|lequel choisir|laquelle choisir|which (?:is|one is) better'

const PRODUCTS =
  'produit|produits|telephone|telephones|smartphone|smartphones|phone|phones|iphone|iphones|samsung|galaxy|pixel|ordinateur|ordinateurs|laptop|laptops|pc|mac|macbook|voiture|voitures|car|cars|tv|television|televisions|hotel|hotels|vol|vols|flight|flights|banque|banques|bank|banks|assurance|assurances|insurance|forfait|forfaits|abonnement|abonnements|subscription|subscriptions|plan|plans|mutuelle|operateur|operateurs'

const COMPARE_PRODUCTS_RE = new RegExp(
  [
    `\\b(?:${COMPARE_VERBS})\\b[^.!?\\n]{0,60}\\b(?:${PRODUCTS})\\b`,
    `\\b(?:${PRODUCTS})\\b[^.!?\\n]{0,40}\\b(?:${COMPARE_VERBS})\\b`
  ].join('|')
)

const CHANGING_FACTS_RE =
  /\b(?:actuel|actuelle|actuels|actuelles|actuellement|currently|current|en ce moment|right now|maintenant|nowadays|de nos jours|a l'heure actuelle|ces derniers temps|recemment|recently|ces jours[- ]ci|lately)\b/

const CHITCHAT_RE =
  /\b(?:salut|bonjour|bonsoir|coucou|hello|hi|hey|yo|merci|merci beaucoup|thanks|thank you|de rien|you're welcome|au revoir|bye|bonne journee|bonne soiree|bonne nuit|good morning|good evening|good night|comment vas[- ]tu|comment allez[- ]vous|how are you|ca va|salama|manao ahoana|misaotra|veloma)\b/

const TRANSLATE_RE =
  /\b(?:traduis|traduisez|traduire|traduction|traductions|translate|translating|translation|reformule|reformulez|reformuler|reformulation|paraphrase|paraphraser|paraphrasez|reecris|reecrivez|reecrire|rewrite|rephrase|reword|corrige|corrigez|corriger|correction|adikao|adika|dikao)\b/

const REWRITE_RE = new RegExp(
  [
    '\\b(?:resume|resumes|resumer|resumez|synthetise|synthetiser|condense|condenser|summarize|summarise|summary)\\b[^.!?\\n]{0,40}\\b(?:texte|text|article|document|paragraphe|paragraph|mail|email|message|contenu|content|pdf|cv|lettre|post)\\b',
    '\\b(?:ameliore|ameliores|ameliorez|ameliorer|corrige|corrigez|corriger|reformule|reecris|rewrite|reecrire)\\b[^.!?\\n]{0,40}\\b(?:cv|lettre de motivation|texte|article|mail|email|message|paragraphe|phrase|orthographe|grammaire|intro|introduction|conclusion|resume)\\b',
    '\\b(?:orthographe|grammaire|fautes?)\\b',
    '\\b(?:fais|donne)[- ]moi un resume\\b'
  ].join('|')
)

const CREATIVE_NOUNS =
  'idee|idees|inspiration|prenom|prenoms|surnom|surnoms|pseudonyme|nom pour|noms pour|poeme|poemes|chanson|chansons|comptine|histoire|histoires|conte|contes|blague|blagues|scenario|scenarios|slogan|slogans|logo|logos|recette|recettes'

const CREATIVE_VERBS =
  'cherche|cherches|cherchez|chercher|recherche|recherches|rechercher|trouve|trouves|trouvez|trouver|donne|donnez|propose|proposes|proposer|suggere|suggerer|suggest|genere|generer|invente|inventer|ecris|ecrire|redige|rediger|raconte|raconter|imagine|imaginer|find|give|suggest|propose|generate|invent|write|create|creer|cree'

const CREATIVE_REQUEST_RE = new RegExp(
  [
    `\\b(?:${CREATIVE_VERBS})\\b[^.!?\\n]{0,40}\\b(?:${CREATIVE_NOUNS})\\b`,
    `\\b(?:${CREATIVE_NOUNS})\\b[^.!?\\n]{0,40}\\b(?:${CREATIVE_VERBS})\\b`
  ].join('|')
)

const PURE_MATH_RE = /^[\s\d.,+\-*/x×÷^%()=?:]+$/

const ARITHMETIC_RE = new RegExp(
  [
    '\\b(?:calcule|calcules|calculez|calculer|combien (?:font|fait|valent))\\b',
    '\\bwhat is \\d',
    '\\d+\\s*[+*/x×÷]\\s*\\d+',
    '\\b(?:equation|equations|resous|resoudre|solve|theoreme|integrale|derivee|pourcentage de \\d|racine carree de)\\b'
  ].join('|')
)

const STABLE_KNOWLEDGE_RE = new RegExp(
  [
    "\\b(?:qu'est[- ]?ce que|qu'est ce que|c'est quoi|kesako|what is|what are|who is|who was|who are|qui est|qui etait|qui sont)\\b",
    '\\b(?:explique|expliques|expliquez|expliquer|explication|explanation|explain|definition|definitions|definis|definir|define)\\b',
    '\\b(?:comment (?:ca |cela )?(?:marche|fonctionne|fonctionnent|fait)|how (?:does|do|did|to) \\w+ (?:work|works)|pourquoi|why (?:is|are|was|were|does|do|did))\\b',
    "\\b(?:difference entre|difference between|histoire (?:de|du|des|d')|raconte[- ]moi (?:l'histoire|la vie|l'origine)|comment (?:apprendre|devenir|faire pour))\\b"
  ].join('|')
)

const CODE_FENCE_RE = /```|~~~/

const SELF_CONTAINED_CODE_RE = new RegExp(
  [
    '\\b(?:corrige|corriges|corrigez|corriger|debug|debugge|debugger|fix|refactor|refactorise|refactoriser|optimise|optimises|optimiser|ameliore|ameliores|ameliorer|review|relis|relire)\\b[^.!?\\n]{0,40}\\b(?:(?:ce|mon|ma|mes|this|my|the|le|la|les)\\s+)?(?:code|script|fonction|function|composant|component|module|classe|class|requete|query|snippet|algorithme|programme|program|bug|erreur|error|stack ?trace|traceback)\\b',
    '\\b(?:ce|mon|this|my)\\s+(?:code|script|fonction|function|composant|component|module|classe|class)\\b',
    '\\bcode (?:ci[- ]dessous|suivant|suivante|below|above)\\b'
  ].join('|')
)

const FOLLOW_UP_CONTINUATION_RE =
  /^(?:et|and|puis|alors|ensuite|donc|aussi|continue|continues|poursuis|poursuit|vas[- ]y|d'accord|daccord|ok|oui|yes|go on|more|suite|apres|davantage|developpe|developpes|approfondis|detaille|raconte la suite|parle[- ]moi[- ]en)\b/

const FOLLOW_UP_PRONOUN_RE =
  /\b(?:cela|ca|cet|cette|ceci|ce|son|sa|ses|leur|leurs|il|elle|ils|elles|lui|eux|it|this|that|these|those|they|them|their|izany|io|ireo|amin'izany)\b/

const NO_SEARCH_RE = new RegExp(
  [
    '\\bne (?:cherche|cherchez|recherche|recherchez) pas\\b',
    '\\bne pas (?:chercher|rechercher)\\b',
    '\\bne fais pas de recherche\\b',
    '\\bpas besoin de (?:chercher|recherche|rechercher)\\b',
    '\\bsans (?:chercher|recherche|rechercher|internet|acces a internet)\\b',
    '\\bpas de recherche(?: web)?\\b',
    "\\bdon't search\\b|\\bdo not search\\b|\\bno need to search\\b|\\bwithout searching\\b|\\bwithout web search\\b",
    '\\baza mitady\\b|\\baza mikaroka\\b|\\btsy mila mitady\\b'
  ].join('|')
)

const DETECTOR_RULES: DetectorRule[] = [
  {
    id: 'explicit-search-request',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.explicitSearchRequest,
    test: input => EXPLICIT_SEARCH_RE.test(input.normalized)
  },
  {
    id: 'news-recent-events',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.newsRecentEvents,
    test: input => NEWS_RE.test(input.normalized)
  },
  {
    id: 'verify-external-source',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.verifyExternalSource,
    test: input =>
      VERIFY_RE.test(input.normalized) ||
      (VERIFY_CLAIM_RE.test(input.normalized) &&
        input.normalized.split(/\s+/).length > 3)
  },
  {
    id: 'prices-weather-rates',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.pricesWeatherRates,
    test: input => PRICES_WEATHER_RE.test(input.normalized)
  },
  {
    id: 'find-online-projects',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.findOnlineProjects,
    test: input => FIND_ONLINE_RE.test(input.normalized)
  },
  {
    id: 'latest-version',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.latestVersion,
    test: input => LATEST_VERSION_RE.test(input.normalized)
  },
  {
    id: 'official-docs',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.officialDocs,
    test: input => OFFICIAL_DOCS_RE.test(input.normalized)
  },
  {
    id: 'external-citations',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.externalCitations,
    test: input => EXTERNAL_CITATIONS_RE.test(input.normalized)
  },
  {
    id: 'compare-products-services',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.compareProductsServices,
    test: input => COMPARE_PRODUCTS_RE.test(input.normalized)
  },
  {
    id: 'changing-facts',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.changingFacts,
    test: input => CHANGING_FACTS_RE.test(input.normalized)
  },
  {
    id: 'greeting-chitchat',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.greetingChitchat,
    test: input =>
      isPureGreeting(input.raw) ||
      (CHITCHAT_RE.test(input.normalized) &&
        input.normalized.split(/\s+/).length <= 8)
  },
  {
    id: 'translation-rewriting',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.translationRewriting,
    test: input =>
      TRANSLATE_RE.test(input.normalized) || REWRITE_RE.test(input.normalized)
  },
  {
    id: 'simple-arithmetic',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.simpleArithmetic,
    test: input =>
      PURE_MATH_RE.test(input.normalized) ||
      ARITHMETIC_RE.test(input.normalized)
  },
  {
    id: 'creative-request',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.creativeRequest,
    test: input => CREATIVE_REQUEST_RE.test(input.normalized)
  },
  {
    id: 'stable-knowledge',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.stableKnowledge,
    suppressedByStrongSignal: true,
    test: input => STABLE_KNOWLEDGE_RE.test(input.normalized)
  },
  {
    id: 'self-contained-code',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.selfContainedCode,
    suppressedByStrongSignal: true,
    test: input =>
      CODE_FENCE_RE.test(input.raw) ||
      SELF_CONTAINED_CODE_RE.test(input.normalized)
  },
  {
    id: 'follow-up-context',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.followUpContext,
    suppressedByStrongSignal: true,
    test: input => {
      if (!input.context?.recentTurns?.length) return false
      const words = input.normalized.split(/\s+/)
      return (
        FOLLOW_UP_CONTINUATION_RE.test(input.normalized) ||
        (words.length <= 7 && FOLLOW_UP_PRONOUN_RE.test(input.normalized))
      )
    }
  }
]

function sumWeights(rules: DetectorRule[]): number {
  return rules.reduce((total, rule) => total + rule.weight, 0)
}

function buildReason(params: {
  needsWebSearch: boolean
  score: number
  matched: DetectorRule[]
  explicitSearch: boolean
  hasWebTarget: boolean
}): string {
  const { needsWebSearch, score, matched, explicitSearch, hasWebTarget } =
    params

  if (matched.length === 0) {
    return 'No external-information signals detected.'
  }

  const summary = matched
    .map(rule => `${rule.id} (${rule.weight > 0 ? '+' : ''}${rule.weight})`)
    .join(', ')

  if (needsWebSearch && explicitSearch) {
    return `Explicit search request${
      hasWebTarget ? '' : ' (imperative command)'
    } overrides other signals: ${summary}.`
  }
  if (needsWebSearch) {
    return `Score ${score} >= ${WEB_SEARCH_SCORE_THRESHOLD}: ${summary}.`
  }
  return `Score ${score} < ${WEB_SEARCH_SCORE_THRESHOLD}: ${summary}.`
}

/**
 * Decide whether `message` needs a live web search before the model answers.
 *
 * @param message Latest user message (any language).
 * @param context Optional lightweight context: a few recent turns used only
 *                for follow-up detection. Never pass the full history.
 */
export function detectWebSearchIntent(
  message: string,
  context?: WebSearchDetectorContext
): WebSearchDetection {
  const raw = typeof message === 'string' ? message : ''
  const normalized = normalize(raw)
  const input: DetectorInput = { raw, normalized, context }

  if (!normalized) {
    return {
      needsWebSearch: false,
      score: 0,
      reason: 'Empty message: nothing to search for.',
      matchedRules: []
    }
  }

  const isNoSearch = NO_SEARCH_RE.test(normalized)

  let matched = DETECTOR_RULES.filter(rule => rule.test(input))

  // Strong external-information signals outweigh "local task" negatives
  // (explaining, fixing code, continuing a thread): those negatives describe
  // how to answer, not why fresh facts are unnecessary.
  const hasStrongSignal = matched.some(
    rule => rule.weight >= STRONG_SIGNAL_WEIGHT
  )
  if (hasStrongSignal) {
    matched = matched.filter(rule => !rule.suppressedByStrongSignal)
  }

  const explicitSearch = matched.some(
    rule => rule.id === 'explicit-search-request'
  )
  const creativeRequest = matched.some(rule => rule.id === 'creative-request')
  const hasWebTarget = WEB_TARGET_RE.test(normalized)
  const score = sumWeights(matched)
  const matchedRules = matched.map(rule => rule.id)

  // An explicit no-search instruction wins over everything, including an
  // otherwise explicit search request.
  if (isNoSearch) {
    return {
      needsWebSearch: false,
      score,
      reason: 'The user explicitly asked not to search the web.',
      matchedRules: ['explicit-no-search', ...matchedRules]
    }
  }

  // An explicit search request wins over negative signals, except when the
  // "command" is really a creative ask ("cherche un prénom pour mon bébé")
  // with no web target in sight — then the regular score decides.
  const needsWebSearch =
    (explicitSearch && (!creativeRequest || hasWebTarget)) ||
    score >= WEB_SEARCH_SCORE_THRESHOLD

  return {
    needsWebSearch,
    score,
    reason: buildReason({
      needsWebSearch,
      score,
      matched,
      explicitSearch,
      hasWebTarget
    }),
    matchedRules
  }
}
