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
 * Entity-aware routing: bare recognizable subjects ("Elon Musk", "Tesla",
 * "GPT-6", "OpenIntelligentUI") are treated as implicit information queries
 * and route to SEARCH. The entity rules combine a compact folded lexicon with
 * structural heuristics (CamelCase tokens, model codes, proper-noun pairs)
 * evaluated on the raw message, because `foldText()` loses capitalisation.
 *
 * Decision: `needsWebSearch = score >= WEB_SEARCH_SCORE_THRESHOLD`, with two
 * overrides:
 * - an explicit search request (a +100 rule) wins over negative signals,
 *   unless the user explicitly asked not to search;
 * - "local task" negatives (explain this, fix this code, continue) are
 *   ignored when a strong external-information signal (>= +70) matched, or,
 *   for "stable knowledge" and follow-up negatives only, when an entity
 *   signal matched (info query about a person/company/model).
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

type EntityKind = 'person' | 'org' | 'model' | 'tech' | 'product'

interface EntityMatch {
  phrase: string
  kind: EntityKind
  source: 'lexicon' | 'structural'
}

interface DetectorInput {
  raw: string
  normalized: string
  context?: WebSearchDetectorContext
  /** Lazily computed entity lookup shared by the entity rules. */
  entityCache?: EntityMatch | null
}

interface DetectorRule {
  id: string
  weight: number
  /** Skipped when a strong external-information signal (>= +70) matched. */
  suppressedByStrongSignal?: boolean
  /** Skipped when an entity signal matched (person/company/model info). */
  suppressedByEntitySignal?: boolean
  /** Marks the rule as an entity signal. */
  entitySignal?: boolean
  test: (input: DetectorInput) => boolean
}

/** Single source of truth for rule weights and the decision threshold. */
export const WEB_SEARCH_DETECTOR_WEIGHTS = {
  explicitSearchRequest: 100,
  newsRecentEvents: 90,
  verifyExternalSource: 90,
  pricesWeatherRates: 85,
  findOnlineProjects: 80,
  latestVersion: 75,
  officialDocs: 75,
  namedEntityInformation: 65,
  entityAttributeQuery: 65,
  entityComparison: 65,
  externalCitations: 50,
  compareProductsServices: 50,
  changingFacts: 35,
  greetingChitchat: -100,
  translationRewriting: -100,
  suppliedTextTransformation: -100,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const SEARCH_VERBS =
  'cherche|cherches|cherchez|chercher|recherche|recherches|recherchez|rechercher|trouve|trouves|trouvez|trouver|search|find|google|look up|tadiavo|karohy|mitady|jereo'

const WEB_TARGETS =
  "web|internet|google|github|gitlab|en ligne|online|sur le net|le net|amin'ny web|amin'ny aterineto|amin'ny internet|ao amin'ny web"

const WEB_TARGET_RE = new RegExp(WEB_TARGETS)

/**
 * Explicit search request. The first pattern guards against noun compounds
 * such as "agent de recherche Web" ("de recherche" is not a command), and the
 * rule as a whole is disabled for past-tense statements ("I searched for
 * Tesla yesterday").
 */
const EXPLICIT_SEARCH_RE = new RegExp(
  [
    "(?<!\\bde )(?<!\\bd')\\b(?:" +
      SEARCH_VERBS +
      ')\\b[^.!?\\n]{0,60}\\b(?:' +
      WEB_TARGETS +
      ')\\b',
    `\\b(?:${WEB_TARGETS})\\b[^.!?\\n]{0,40}\\b(?:${SEARCH_VERBS})\\b`,
    '\\bfais[- ]?(?:moi )?une recherche\\b',
    '\\bgoogle (?:it|le|la|ca|cela)\\b',
    '\\blook it up\\b',
    `^(?:peux[- ]tu |pourrais[- ]tu |peut[- ]tu |can you |could you |please )?(?:${SEARCH_VERBS})\\b`
  ].join('|')
)

/**
 * Past-tense search narratives ("I searched for Tesla yesterday", "j'ai
 * cherché des infos sur Tesla hier") are statements, not requests: they must
 * not trigger the explicit-search override.
 */
const PAST_SEARCH_RE = new RegExp(
  [
    "\\b(?:j'ai|j ai|j'avais|j avais|j'avait|nous avons|on a|i|we)\\s+(?:deja\\s+|already\\s+)?(?:cherche|recherche|trouve|searched|looked up|googled|found)\\b",
    '\\b(?:cherche|recherche|trouve|searched|googled|looked up)\\b[^.!?\\n]{0,20}\\b(?:hier|yesterday|la semaine derniere|last week|last night|earlier|plus tot)\\b',
    '\\befa\\s+(?:nitady|nikaroka|nijery)\\b'
  ].join('|')
)

/** "Explique la recherche Web" describes the topic, it is not a search command. */
const EXPLICIT_EXPLAIN_GUARD_RE =
  /\b(?:explique|expliques|expliquez|expliquer|explain|difference (?:entre|between))\b[^.!?\n]{0,40}\b(?:recherche|recherches|rechercher|chercher|search|searches|searching)\b/

const NEWS_RE = new RegExp(
  [
    "\\b(?:actualites?|actus?|news|headlines|vaovao|nouveautes?|nouvelles du jour|derniere heure|dernieres? (?:infos|informations|nouvelles)|infos? (?:recentes?|du jour)|quoi de neuf|what's new|whats new|breaking news)\\b",
    "\\b(?:aujourd'hui|today|androany|hier|yesterday|omaly|ce matin|ce soir|cette semaine|this week)\\b[^.!?\\n]{0,60}\\b(?:se passe|passe-t-il|passe t il|happening|events?|evenements?|info|news|actualite|nouveaute|new|sortie|sort|annonce|vaovao|resultat|score)\\b",
    "\\b(?:se passe|passe-t-il|passe t il|il se passe|happening)\\b[^.!?\\n]{0,60}\\b(?:aujourd'hui|today|androany|maintenant|now|ce matin|ce soir|cette semaine)\\b",
    '\\b(?:nouveau|nouvel|nouveaux|nouvelle|nouvelles|new|latest|dernier|derniere)\\s+(?:president|presidente|maire|ceo|pdg|premier ministre|prime minister|gouvernement|government|champion|championne|vainqueur|gagnant|record|pape)\\b',
    '\\b(?:casting|bande[- ]annonce|teaser|trailer|date de sortie|release date|sortie (?:au cinema|prevue|confirmee))\\b',
    "\\b(?:score (?:du match|final)|resultats? (?:du match|de l'election|des elections)|elections? (?:de |du |presidentielles? )?20\\d\\d|en direct|live)\\b",
    "\\b(?:classement|standings|ligue 1|premier league|champions league|coupe du monde|world cup|can 20\\d\\d|euro 20\\d\\d|lalao|valin[' ]?ny lalao)\\b",
    "\\b(?:what happened|whats happening|que s'est[- ]il passe|qu'est[- ]ce qui s'est passe|inona no nitranga)\\b",
    "\\b(?:vient d'annoncer|recently announced|just announced|a annonce|annonces? (?:recentes?|du jour))\\b"
  ].join('|')
)

/** Recency markers that keep a news / weather / price query concrete. */
const RECENCY_RE =
  /\b(?:aujourd'hui|today|androany|demain|tomorrow|rahampitso|maintenant|now|ce matin|ce soir|cette semaine|this week|hier|yesterday|omaly|recent(?:e|es|s)?|recemment|recently|derniers?|dernieres?|latest|du jour|en ce moment|right now|actuellement|currently)\b/

/** Conceptual explanations about news ("Pourquoi les actualités changent") are not requests. */
const NEWS_EXPLAIN_RE =
  /\b(?:pourquoi|why|explique|expliques|expliquez|expliquer|explain|difference (?:entre|between))\b[^.!?\n]{0,40}\b(?:actualites?|actus?|news|infos?|informations?|nouvelles?|vaovao)\b/

const VERIFY_RE = new RegExp(
  [
    '\\b(?:verifie|verifies|verifiez|verifier|valide|valider|validate|confirme|confirmer|confirm|fact[- ]?check|hamarino)\\b[^.!?\\n]{0,60}\\b(?:source|sources|repo|repository|licence|license|url|lien|liens|link|links|information|cette info|document|site|page|article|projet|project|documentation|api|pdf|depeche|claim|affirmation|fait)\\b',
    '\\b(?:check|verify)\\b[^.!?\\n]{0,60}\\b(?:source|sources|repo|repository|license|url|link|links|information|document|site|page|article|project|documentation|api|maintained|still)\\b',
    '\\b(?:encore|toujours|still|mbola)\\s+(?:maintenu\\w*|maintained|supporte\\w*|supported|fonctionne\\w*|marche|works?|actif|active|a jour|up to date|valable|valide|relevant|pertinent|en ligne|available|disponible|en vie|velona|misy|mandeha)\\b',
    '\\b(?:projet|project|repo|repos|repository|librairie|library|package|outil|tool|framework|module|logiciel|software|api|sdk|methode|method|technique|approche|site|website|page|boutique|shop|application|app)\\b[^.!?\\n]{0,40}\\b(?:abandonne\\w*|abandoned|deprecated|obsolete\\w*|deprecie\\w*|plus (?:maintenu|maintenue|suivi|suivie)\\w*|no longer maintained|legitime?s?|legit|fiable|credible|sur|safe|securise\\w*|scam|arnaque|fake|frauduleux\\w*|officiel\\w*|up to date|a jour)\\b',
    '\\b(?:fonctionne|fonctionnent|marche|marchent|works?)\\b[^.!?\\n]{0,20}\\b(?:encore|toujours|still)\\b',
    '\\b(?:encore|toujours|still)\\b[^.!?\\n]{0,20}\\b(?:fonctionne|fonctionnent|marche|marchent|works?)\\b',
    '\\b(?:verifie|verifies|verifiez|verifier|check|verify|confirme|confirmez|confirm)\\b[^.!?\\n]{0,40}\\b(?:ce que tu (?:as dit|viens de dire)|ta (?:reponse|derniere reponse)|tes (?:sources|infos|informations|chiffres|affirmations|propos)|your (?:answer|response|sources|facts|claims|numbers))\\b',
    "\\b(?:licence|license)s?\\b[^.!?\\n]{0,30}\\b(?:de|du|d'|of)\\b[^.!?\\n]{0,30}\\b(?:projet|project|repo|repository|logiciel|software|code|librairie|library|module)\\b"
  ].join('|')
)

const VERIFY_CLAIM_RE =
  /\b(?:is (?:it|this|that) (?:true|correct|accurate)|est[- ]?ce (?:vrai|exact|correct)|vrai ou faux|c'est (?:vrai|exact) que)\b/

const PRICE_CORE_RE = new RegExp(
  [
    '\\bcombien (?:coute|coute-t|coute[- ]t[- ](?:il|elle)|coutent|ca coute|cela coute|vaut|valent|vaut[- ]t[- ](?:il|elle))\\b',
    '\\bhow much (?:is|are|does|do|did|cost|costs|worth)\\b',
    "\\b(?:taux de change|exchange rate|cours (?:de l'action|de la bourse|du bitcoin|de l'or|du dollar|de l'euro|des actions|du petrole|de la crypto|du riz)|stock price|market cap|capitalisation boursiere|chiffre d'affaires|resultats? (?:financiers|trimestriels|annuels)|quarterly results)\\b",
    '\\b(?:ohatrinona|firy ny vidin\\w*|vidiny)\\b',
    '\\bcombien\\b[^.!?\\n]{0,20}\\bcoute\\b',
    '\\bcoute\\b[^.!?\\n]{0,20}\\bcombien\\b'
  ].join('|')
)

const PRICE_AMBIENT_RE =
  /\b(?:prix|price|prices|precio|vidy|tarif|tarifs|couts?|cost|costs|pas cher|moins cher|bons? plans?|promotions?|deals?|discounts?|soldes?|ou acheter|where to buy|acheter|buy)\b/

const PRICE_CONCEPT_RE =
  /\b(?:difference (?:entre|between)|explique|expliques|expliquez|expliquer|explain)\b[^.!?\n]{0,40}\b(?:prix|price|cout|cost|valeur|value|tarif)\b/

const WEATHER_RE =
  /\b(?:meteo|weather|forecast|previsions?|temperature|temperatures|toetrandro|toetr'andro|quel temps|va[- ]t[- ]il pleuvoir|will it rain|il va pleuvoir|going to rain|pluie|pleut|pleuvoir|neige|snow|humidite|humidity)\b/

const WEATHER_CONCEPT_RE =
  /\b(?:difference (?:entre|between)|pourquoi|why|explique|expliques|expliquez|expliquer|explain)\b[^.!?\n]{0,40}\b(?:meteo|weather|climat|climate|toetrandro)\b/

const TIME_LOCAL_RE =
  /\b(?:quelle heure|what time|what(?:'s| is) the time|firy ny ora|pres de moi|near me|autour de moi|a cote de moi|ouvert(?:s|es)? (?:maintenant|actuellement|aujourd'hui|ce soir)|open now|ouvert maintenant)\b/

const AVAILABILITY_RE = new RegExp(
  [
    '\\b(?:disponibilite|availability|en stock|in stock)\\b',
    '\\b(?:est|sont|sera|seront|quand|when|is|are|will)\\b[^.!?\\n]{0,40}\\b(?:disponible|disponibles|available|dispo)\\b',
    "\\bis it free\\b|\\best[- ]?ce (?:que c'est )?gratuit\\b"
  ].join('|')
)

const FIND_VERBS =
  'trouve|trouves|trouvez|trouver|cherche|cherches|cherchez|chercher|recherche|recherches|recherchez|rechercher|find|search|recommande|recommandes|recommander|recommend|suggest|suggere|suggerer|liste|list|compare|compares|comparent|comparer|donne|donnez|give|montre|montrez|show|meilleur|meilleure|meilleurs|meilleures|best'

const ONLINE_OBJECTS =
  'api|apis|librairie|librairies|bibliotheque|bibliotheques|library|libraries|framework|frameworks|package|packages|outil|outils|tool|tools|service|services|plateforme|plateformes|platform|platforms|projet|projets|project|projects|open[- ]?source|github|npm|pip|pypi|crate|crates|module|modules|app|apps|application|applications|logiciel|logiciels|software|bot|bots|plugin|plugins|dataset|datasets|alternatives?|concurrents?|competiteurs?|sdk|repo|repos|repository|repositories|hosting|hebergement|hebergeur|publication|publications|etude|etudes|paper|papers|campagne|campagnes|publicite|publicites|detecteur|detecteurs|classifier|classifiers|workspace|prompt|prompts'

const FIND_ONLINE_RE = new RegExp(
  [
    `\\b(?:${FIND_VERBS})\\b[^.!?\\n]{0,60}\\b(?:${ONLINE_OBJECTS})\\b`,
    `\\b(?:${ONLINE_OBJECTS})\\b[^.!?\\n]{0,40}\\b(?:${FIND_VERBS})\\b`
  ].join('|')
)

const LATEST_VERSION_RE = new RegExp(
  [
    '\\b(?:derniere|dernier|derniers|dernieres|latest|newest|current|actuel|actuelle|actuels|actuelles|nouveau|nouvel|nouveaux|nouvelle|nouvelles|vaovao|farany)\\s+(?:version|versions|release|releases|mise a jour|mises a jour|update|updates|modele|modeles|model|models|edition|editions|sortie|sorties|api|sdk|lts|discoveries|decouvertes)\\b',
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

const COMPARE_VERB_RE = new RegExp(`\\b(?:${COMPARE_VERBS})\\b`)

const PRODUCTS =
  'produit|produits|telephone|telephones|smartphone|smartphones|phone|phones|iphone|iphones|samsung|galaxy|pixel|ordinateur|ordinateurs|laptop|laptops|pc|mac|macbook|voiture|voitures|car|cars|tv|television|televisions|hotel|hotels|vol|vols|flight|flights|banque|banques|bank|banks|assurance|assurances|insurance|forfait|forfaits|abonnement|abonnements|subscription|subscriptions|plan|plans|mutuelle|operateur|operateurs|model|modeles|models|provider|providers|fournisseur|fournisseurs'

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

/** Text supplied by the user (pasted, attached) is a local transformation task. */
const SUPPLIED_TEXT_RE = new RegExp(
  [
    '\\b(?:que je viens de (?:te )?(?:donner|envoyer|coller|partager|fournir)|je viens de (?:te )?(?:coller|donner|envoyer|partager|fournir))\\b',
    '\\b(?:le |ce |cet |cette )?(?:texte|document|message|fichier|extrait)\\b[^.!?\\n]{0,15}\\b(?:ci[- ]dessus|ci[- ]joint|precedent|suivant|fourni|donne|colle|envoye)\\b',
    '\\ba partir de (?:ce|cet|cette|ces|mes|mon|ma|du|des|la|le|les) (?:texte|donnees|informations|documents|chiffres|extrait|fichier)\\b',
    '\\b(?:i (?:just )?(?:pasted|gave|sent|provided|shared)|as i (?:pasted|mentioned|said|wrote))\\b',
    '\\bbased on (?:this|these|the) (?:text|data|content|document|information|info|file|excerpt)\\b',
    '\\bthe (?:text|data|document|information) (?:above|below)\\b',
    '\\b(?:use only|utilise uniquement|utilise seulement|en te basant (?:uniquement )?sur) (?:the |le |la |les |ce |cet |cette |ces )?(?:text|texte|data|donnees|document|information|informations|contenu|content)\\b'
  ].join('|')
)

const CREATIVE_NOUNS =
  'idee|idees|inspiration|prenom|prenoms|surnom|surnoms|pseudonyme|nom pour|noms pour|poeme|poemes|chanson|chansons|comptine|histoire|histoires|conte|contes|blague|blagues|scenario|scenarios|slogan|slogans|logo|logos|recette|recettes|prompt|prompts|story|stories|roman|romans|novel|novels|fiction|fictions|fable|fables'

const CREATIVE_VERBS =
  'cherche|cherches|cherchez|chercher|recherche|recherches|rechercher|trouve|trouves|trouvez|trouver|donne|donnez|propose|proposes|proposer|suggere|suggerer|suggest|genere|generer|invente|inventer|ecris|ecrire|redige|rediger|raconte|raconter|imagine|imaginer|find|give|suggest|propose|generate|invent|write|create|creer|cree|fais|faites'

const CREATIVE_REQUEST_RE = new RegExp(
  [
    `\\b(?:${CREATIVE_VERBS})\\b[^.!?\\n]{0,40}\\b(?:${CREATIVE_NOUNS})\\b`,
    `\\b(?:${CREATIVE_NOUNS})\\b[^.!?\\n]{0,40}\\b(?:${CREATIVE_VERBS})\\b`
  ].join('|')
)

/** "Écris une actualité fictive" — fiction markers make the ask creative. */
const FICTIF_RE =
  /\b(?:fictif|fictive|fictifs|fictives|fictionnel|fictionnelle|fictionnels|fictionnelles|imaginaire|imaginaires|fictional|fictitious|imaginary)\b/

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
    "\\bne (?:veux|veut|souhaites|souhaite) pas (?:que tu |qu'on |de |d'|faire de |faire |une |des )?(?:cherch\\w*|recherch\\w*)\\b",
    '\\bne fais pas de recherche\\b',
    '\\bpas besoin de (?:chercher|recherche|rechercher)\\b',
    '\\bsans (?:chercher|recherche|rechercher|internet|acces a internet|faire de recherche|aller sur le web)\\b',
    '\\bpas de recherches?\\b',
    '\\baucune recherche\\b',
    "\\bdon't search\\b|\\bdo not search\\b|\\bdon't browse\\b|\\bdo not browse\\b|\\bno need to search\\b|\\bwithout searching\\b|\\bwithout browsing\\b|\\bwithout web search\\b|\\bno browsing\\b|\\bstay offline\\b",
    '\\b(?:use|utilise|utiliser) (?:only|uniquement|seulement) (?:the |le |la |les |ce |cet |cette |ces |ton |ta |tes )?(?:text|texte|data|donnees|document|information|informations|contenu|content|connaissances|knowledge)\\b',
    '\\bbased only on (?:the |this |these )?(?:text|data|document|context|information)\\b',
    '\\banswer from (?:the conversation|your (?:own )?knowledge)\\b',
    '\\bfrom your own knowledge\\b',
    '\\buniquement avec (?:tes|ta|vos|votre) (?:connaissances|memoire|savoir)\\b',
    '\\bavec (?:tes|ta|vos|votre) (?:connaissances|memoire|savoir)\\b',
    '\\breponds? de memoire\\b',
    "\\breponds? (?:uniquement )?(?:d'apres|a partir de|en te basant sur) (?:tes|ta|vos|votre) (?:connaissances|memoire|savoir)\\b",
    '\\baza mitady\\b|\\baza mikaroka\\b|\\baza mijery (?:ny )?web\\b|\\btsy (?:mila|tokony) (?:mitady|mikaroka)\\b'
  ].join('|')
)

/* --------------------------------------------------------------------------
 * Entity awareness (person / company / model / project names).
 * ------------------------------------------------------------------------ */

const ENTITY_LEXICON: ReadonlyArray<readonly [string, EntityKind]> = [
  // Public figures
  ['elon musk', 'person'],
  ['sam altman', 'person'],
  ['emmanuel macron', 'person'],
  ['donald trump', 'person'],
  ['joe biden', 'person'],
  ['kamala harris', 'person'],
  ['vladimir poutine', 'person'],
  ['vladimir putin', 'person'],
  ['xi jinping', 'person'],
  ['bill gates', 'person'],
  ['jeff bezos', 'person'],
  ['mark zuckerberg', 'person'],
  ['sundar pichai', 'person'],
  ['tim cook', 'person'],
  ['jensen huang', 'person'],
  ['cristiano ronaldo', 'person'],
  ['lionel messi', 'person'],
  ['kylian mbappe', 'person'],
  ['michael jackson', 'person'],
  ['taylor swift', 'person'],
  ['victor hugo', 'person'],
  ['albert einstein', 'person'],
  ['napoleon', 'person'],
  ['andry rajoelina', 'person'],
  ['marc ravalomanana', 'person'],
  // Companies and organisations
  ['tesla', 'org'],
  ['spacex', 'org'],
  ['openai', 'org'],
  ['anthropic', 'org'],
  ['microsoft', 'org'],
  ['apple', 'org'],
  ['google', 'org'],
  ['meta', 'org'],
  ['amazon', 'org'],
  ['netflix', 'org'],
  ['nvidia', 'org'],
  ['intel', 'org'],
  ['samsung', 'org'],
  ['huawei', 'org'],
  ['xiaomi', 'org'],
  ['bytedance', 'org'],
  ['tiktok', 'org'],
  ['uber', 'org'],
  ['airbnb', 'org'],
  ['spotify', 'org'],
  ['twitter', 'org'],
  ['alibaba', 'org'],
  ['tencent', 'org'],
  ['binance', 'org'],
  ['coinbase', 'org'],
  ['paypal', 'org'],
  ['nike', 'org'],
  ['adidas', 'org'],
  ['coca-cola', 'org'],
  ['byd', 'org'],
  ['toyota', 'org'],
  ['volkswagen', 'org'],
  ['renault', 'org'],
  ['peugeot', 'org'],
  ['boeing', 'org'],
  ['airbus', 'org'],
  ['airtel', 'org'],
  ['telma', 'org'],
  ['jirama', 'org'],
  ['stripe', 'org'],
  // AI models and assistants
  ['gpt', 'model'],
  ['chatgpt', 'model'],
  ['claude', 'model'],
  ['gemini', 'model'],
  ['llama', 'model'],
  ['mistral', 'model'],
  ['deepseek', 'model'],
  ['qwen', 'model'],
  ['grok', 'model'],
  ['copilot', 'model'],
  ['midjourney', 'model'],
  ['sora', 'model'],
  ['nemotron', 'model'],
  ['whisper', 'model'],
  ['dall-e', 'model'],
  ['stable diffusion', 'model'],
  // Platforms and frameworks
  ['github', 'tech'],
  ['gitlab', 'tech'],
  ['youtube', 'tech'],
  ['instagram', 'tech'],
  ['whatsapp', 'tech'],
  ['telegram', 'tech'],
  ['discord', 'tech'],
  ['reddit', 'tech'],
  ['wikipedia', 'tech'],
  ['stack overflow', 'tech'],
  ['notion', 'tech'],
  ['figma', 'tech'],
  ['vercel', 'tech'],
  ['next.js', 'tech'],
  ['nextjs', 'tech'],
  ['docker', 'tech'],
  ['kubernetes', 'tech'],
  ['react', 'tech'],
  ['vue', 'tech'],
  ['angular', 'tech'],
  ['svelte', 'tech'],
  ['node.js', 'tech'],
  ['nodejs', 'tech'],
  ['supabase', 'tech'],
  ['postgresql', 'tech'],
  ['postgres', 'tech'],
  ['mongodb', 'tech'],
  ['redis', 'tech'],
  ['wordpress', 'tech'],
  ['shopify', 'tech'],
  ['tailwind', 'tech']
]

const ENTITY_KIND_BY_PHRASE = new Map(
  ENTITY_LEXICON.map(entry => [entry[0], entry[1]])
)

const ENTITY_PHRASES_SORTED = [...ENTITY_KIND_BY_PHRASE.keys()].sort(
  (a, b) => b.length - a.length
)

const ENTITY_PHRASE_RE = new RegExp(
  `\\b(?:${ENTITY_PHRASES_SORTED.map(escapeRegExp).join('|')})\\b`
)

const ENTITY_PHRASE_GLOBAL_RE = new RegExp(ENTITY_PHRASE_RE.source, 'g')

/** Stable technologies the model already knows well; not "search me" signals. */
const KNOWN_STABLE_CAMEL = new Set([
  'typescript',
  'javascript',
  'graphql',
  'powershell',
  'webpack',
  'eslint',
  'turbopack',
  'homebrew',
  'openapi',
  'mysql',
  'mariadb',
  'vitejs'
])

const MODEL_CODE_PATTERN =
  '(?:gpt|chatgpt|claude|gemini|llama|qwen|grok|deepseek|mistral|nemotron|sora|dall-e|dalle|whisper|phi)'

const MODEL_CODE_ANY_RE = new RegExp(
  `\\b${MODEL_CODE_PATTERN}[\\s.-]?\\d+(?:[.-]\\d+)*(?:[a-z]{1,3})?\\b`,
  'i'
)

const MODEL_CODE_GLOBAL_RE = new RegExp(MODEL_CODE_ANY_RE.source, 'gi')

const MODEL_CODE_EXACT_RE = new RegExp(
  `^${MODEL_CODE_PATTERN}[\\s.-]?\\d+(?:[.-]\\d+)*(?:[a-z]{1,3})?$`,
  'i'
)

const CAMEL_PAIR_RE = /[\p{Ll}][\p{Lu}]/u

const WORD_TOKEN_SPLIT_RE = /[^\p{L}\p{N}_.'-]+/u

const PROPER_PAIR_STOPWORDS = new Set(
  [
    'le',
    'la',
    'les',
    'l',
    'un',
    'une',
    'des',
    'du',
    'de',
    'd',
    'au',
    'aux',
    'the',
    'a',
    'an',
    'my',
    'mon',
    'ma',
    'mes',
    'ton',
    'ta',
    'tes',
    'son',
    'sa',
    'ses',
    'notre',
    'nos',
    'votre',
    'vos',
    'leur',
    'leurs',
    'your',
    'his',
    'her',
    'its',
    'their',
    'i',
    'je',
    'j',
    'tu',
    'te',
    'toi',
    'il',
    'elle',
    'on',
    'nous',
    'vous',
    'ils',
    'elles',
    'you',
    'we',
    'they',
    'he',
    'she',
    'it',
    'me',
    'moi',
    'lui',
    'eux',
    'them',
    'us',
    'qui',
    'que',
    'quoi',
    'quel',
    'quelle',
    'quels',
    'quelles',
    'what',
    'which',
    'who',
    'whom',
    'whose',
    'ou',
    'where',
    'quand',
    'when',
    'comment',
    'how',
    'pourquoi',
    'why',
    'combien',
    'est',
    'sont',
    'etait',
    'etaient',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'et',
    'and',
    'or',
    'mais',
    'but',
    'pour',
    'for',
    'avec',
    'with',
    'sans',
    'without',
    'sur',
    'on',
    'in',
    'dans',
    'chez',
    'at',
    'to',
    'from',
    'par',
    'by',
    'ce',
    'cet',
    'cette',
    'ces',
    'this',
    'that',
    'these',
    'those',
    'bonjour',
    'salut',
    'coucou',
    'hello',
    'hi',
    'hey',
    'merci',
    'thanks',
    'thank',
    'please',
    'svp',
    'bonne',
    'bon',
    'good',
    'morning',
    'evening',
    'night',
    'journee',
    'soiree',
    'monsieur',
    'madame',
    'mademoiselle',
    'explique',
    'explain',
    'parle',
    'parlez',
    'parler',
    'tell',
    'dis',
    'dites',
    'dire',
    'say',
    'donne',
    'donnez',
    'donner',
    'give',
    'cherche',
    'cherchez',
    'chercher',
    'trouve',
    'trouvez',
    'trouver',
    'find',
    'search',
    'montre',
    'montrez',
    'show',
    'veux',
    'veut',
    'vouloir',
    'want',
    'peux',
    'peut',
    'pouvoir',
    'can',
    'could',
    'would',
    'aimerais',
    'voudrais',
    'nouveau',
    'nouvel',
    'nouvelle',
    'nouvelles',
    'dernier',
    'derniere',
    'derniers',
    'dernieres',
    'latest',
    'actualite',
    'actualites',
    'news',
    'iza',
    'inona',
    'ahoana',
    'ny',
    'sy',
    'dia',
    'moa',
    'vaovao',
    'manao',
    'veloma',
    'misaotra'
  ].map(word => foldText(word))
)

const PROPER_PAIR_RE =
  /(?=(^|[\s"'«(\[])(\p{Lu}[\p{Ll}'’-]{1,})\s+(\p{Lu}[\p{Ll}'’-]{1,}))/gu

const ENTITY_SUFFIX_RE =
  /^(?:v?\d+(?:[.-]\d+)*(?:[a-z]{1,3})?|model \w+|modele \w+|series \w+|pro|max|plus|mini|lite|air|ultra|flash|nano|turbo|sonnet|opus|haiku)(?:\s+(?:v?\d+(?:[.-]\d+)*(?:[a-z]{1,3})?|pro|max|plus|mini|lite|air|ultra|flash|nano|turbo|sonnet|opus|haiku)){0,2}$/

const CONTINUATION_PREFIX_WORDS = new Set(
  ['et', 'and', 'puis', 'alors', 'sinon', 'mais', 'but', 'ok'].map(word =>
    foldText(word)
  )
)

const ENTITY_INFO_LEAD_RE = new RegExp(
  [
    "\\b(?:qui est|qui etait|qui etaient|qui sont|c'est qui|c est qui|who is|who was|who are|who's)\\b",
    "\\b(?:tell me about|parle[- ]moi d|parle[- ]moi de|raconte[- ]moi (?:la vie|le parcours|l'histoire|l histoire)|biographie|biography|bio de)\\b",
    '\\b(?:iza|inona no ataon)\\b',
    '\\b(?:que fait|que font|what does|what do)\\b',
    "\\b(?:net worth|fortune de|fortune d'|patrimoine de|patrimoine d'|quel age|quelle age|how old|age de|age d')\\b",
    "\\b(?:lazao amiko|lazaina amiko|momba an[' ]?i)\\b",
    '\\b(?:qui a (?:cree|creee|fonde|fondee|invente|inventee|decouvert|construit)|who (?:created|founded|invented|discovered|built)|quand a (?:ete cree|creee|fonde|fondee)|when was [^.!?\\n]{0,20} (?:founded|created|born))\\b'
  ].join('|')
)

const ENTITY_WHAT_IS_RE =
  /\b(?:qu'est[- ]?ce (?:que|qu')|qu est ce que|c'est quoi|c est quoi|kesako|inona ny|what is|what's|whats|what are)\b/

const ENTITY_ATTRIBUTES =
  'biographie|bio|fortune|patrimoine|net worth|wealth|entreprises?|societes?|compagnies?|company|companies|start[- ]?ups?|actions?|stock|shares|valeur|valorisation|market cap|capitalisation|revenus?|revenues?|salaire|salary|age|femme|mari|epouse|epoux|enfants?|fils|fille|famille|business|empire|fondateurs?|ceo|pdg|patron|directeur|president|siege|headquarters|hq'

const ENTITY_POSSESSIVE_ATTR_RE = new RegExp(
  `\\b(?:sa|son|ses|leur|leurs|their|its|his|her)\\s+(?:${ENTITY_ATTRIBUTES})\\b`
)

const ENTITY_ATTR_LINK_RE = new RegExp(
  `\\b(?:${ENTITY_ATTRIBUTES})\\b[^.!?\\n]{0,30}\\b(?:de|du|d'|of)\\b`
)

const FINANCE_ENTITY_WORD_RE =
  /\b(?:actions?|stock|shares|market cap|capitalisation|bourse|revenus?|revenues?|revenue|results?|earnings|benefices?|chiffre d'affaires|valorisation|valuation|dividendes?)\b/

const VS_SPLIT_RE = /\s+(?:vs\.?|versus|contre|against)\s+/

const YEAR_RE = /\b(?:19|20)\d\d\b/

function findCamelTokens(raw: string): string[] {
  const tokens: string[] = []
  for (const token of raw.split(WORD_TOKEN_SPLIT_RE)) {
    if (token.length < 4) continue
    if (!/\p{L}/u.test(token)) continue
    if (!CAMEL_PAIR_RE.test(token)) continue
    if (KNOWN_STABLE_CAMEL.has(foldText(token))) continue
    tokens.push(token)
  }
  return tokens
}

function findCamelToken(raw: string): string | null {
  return findCamelTokens(raw)[0] ?? null
}

function findProperPairInText(raw: string): string | null {
  PROPER_PAIR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PROPER_PAIR_RE.exec(raw)) !== null) {
    // Zero-width lookahead matches do not advance lastIndex automatically.
    if (match.index === PROPER_PAIR_RE.lastIndex) {
      PROPER_PAIR_RE.lastIndex += 1
    }
    const first = match[2]
    const second = match[3]
    if (!first || !second) continue
    if (PROPER_PAIR_STOPWORDS.has(foldText(first))) continue
    if (PROPER_PAIR_STOPWORDS.has(foldText(second))) continue
    return `${first} ${second}`
  }
  return null
}

function stripContinuationPrefix(raw: string): string {
  let words = raw.trim().split(/\s+/)
  if (words.length === 0) return raw.trim()
  while (
    words.length > 1 &&
    CONTINUATION_PREFIX_WORDS.has(foldText(words[0]))
  ) {
    words = words.slice(1)
  }
  if (
    words.length > 2 &&
    foldText(words[0]) === 'what' &&
    foldText(words[1]) === 'about'
  ) {
    words = words.slice(2)
  }
  return words.join(' ')
}

function findAnyEntity(input: DetectorInput): EntityMatch | null {
  const lexMatch = ENTITY_PHRASE_RE.exec(input.normalized)
  if (lexMatch) {
    const phrase = lexMatch[0]
    return {
      phrase,
      kind: ENTITY_KIND_BY_PHRASE.get(phrase) ?? 'org',
      source: 'lexicon'
    }
  }

  const codeMatch = MODEL_CODE_ANY_RE.exec(input.raw)
  if (codeMatch) {
    return { phrase: codeMatch[0], kind: 'model', source: 'structural' }
  }

  const camel = findCamelToken(input.raw)
  if (camel) {
    return { phrase: camel, kind: 'product', source: 'structural' }
  }

  const pair = findProperPairInText(input.raw)
  if (pair) {
    return { phrase: pair, kind: 'person', source: 'structural' }
  }

  return null
}

function getEntity(input: DetectorInput): EntityMatch | null {
  if (input.entityCache === undefined) {
    input.entityCache = findAnyEntity(input)
  }
  return input.entityCache
}

function isBareEntityMessage(input: DetectorInput): boolean {
  const rawTrimmed = input.raw.trim().replace(/[?!.,;:…\s]+$/u, '')
  if (!rawTrimmed) return false
  const rawCore = stripContinuationPrefix(rawTrimmed)
  const core = foldText(rawCore)
  if (!core) return false
  if (core.split(/\s+/).length > 4) return false

  for (const [phrase] of ENTITY_LEXICON) {
    if (core === phrase) return true
    if (core.startsWith(`${phrase} `)) {
      const rest = core.slice(phrase.length + 1).trim()
      if (ENTITY_SUFFIX_RE.test(rest)) return true
    }
  }

  if (MODEL_CODE_EXACT_RE.test(core)) return true

  const camel = findCamelToken(rawCore)
  if (camel && foldText(camel) === core) return true

  const pair = findProperPairInText(rawCore)
  if (pair && foldText(pair) === core) return true

  return false
}

function isEntityAtMessageEnd(
  normalized: string,
  entityPhrase: string
): boolean {
  const trimmed = normalized.replace(/[?!.,;:…\s]+$/u, '')
  const needle = foldText(entityPhrase)
  const index = trimmed.lastIndexOf(needle)
  if (index === -1) return false
  const tail = trimmed.slice(index + needle.length)
  if (tail === '' || tail === 's') return true
  const possessive = /^'s(?: [^.!?\n]{0,25})?$/.test(tail)
  return possessive
}

/** "OpenIntelligentUI c'est quoi ?" — entity first, question marker after. */
function isEntityAtMessageStart(
  normalized: string,
  entityPhrase: string
): boolean {
  const needle = foldText(entityPhrase)
  if (!normalized.startsWith(needle)) return false
  const tail = normalized.slice(needle.length)
  return tail.length <= 25
}

function containsEntityText(text: string): boolean {
  if (!text) return false
  if (ENTITY_PHRASE_RE.test(text)) return true
  if (MODEL_CODE_ANY_RE.test(text)) return true
  if (findCamelToken(text)) return true
  return false
}

function countDistinctEntities(input: DetectorInput): number {
  const found = new Set<string>()
  for (const match of input.normalized.matchAll(ENTITY_PHRASE_GLOBAL_RE)) {
    found.add(match[0])
  }
  for (const match of input.raw.matchAll(MODEL_CODE_GLOBAL_RE)) {
    found.add(match[0].toLowerCase())
  }
  for (const token of findCamelTokens(input.raw)) {
    found.add(foldText(token))
  }
  return found.size
}

function matchesNews(input: DetectorInput): boolean {
  const normalized = input.normalized
  if (!NEWS_RE.test(normalized)) return false
  if (NEWS_EXPLAIN_RE.test(normalized) && !RECENCY_RE.test(normalized)) {
    return false
  }
  return true
}

function matchesPricesWeather(input: DetectorInput): boolean {
  const normalized = input.normalized
  if (PRICE_CORE_RE.test(normalized)) return true
  const recency = RECENCY_RE.test(normalized)
  if (PRICE_AMBIENT_RE.test(normalized)) {
    if (!PRICE_CONCEPT_RE.test(normalized) || recency) return true
  }
  if (WEATHER_RE.test(normalized)) {
    if (!WEATHER_CONCEPT_RE.test(normalized) || recency) return true
  }
  if (TIME_LOCAL_RE.test(normalized)) return true
  if (AVAILABILITY_RE.test(normalized)) return true
  return false
}

function matchesNamedEntityInformation(input: DetectorInput): boolean {
  if (matchesNews(input)) return false
  if (isBareEntityMessage(input)) return true
  const entity = getEntity(input)
  if (!entity || entity.kind === 'tech') return false
  if (ENTITY_INFO_LEAD_RE.test(input.normalized)) return true
  if (ENTITY_WHAT_IS_RE.test(input.normalized)) {
    if (isEntityAtMessageEnd(input.normalized, entity.phrase)) return true
    if (isEntityAtMessageStart(input.normalized, entity.phrase)) return true
  }
  return false
}

function matchesEntityAttribute(input: DetectorInput): boolean {
  const normalized = input.normalized
  if (ENTITY_POSSESSIVE_ATTR_RE.test(normalized)) return true
  if (!getEntity(input)) return false
  if (FINANCE_ENTITY_WORD_RE.test(normalized)) return true
  return ENTITY_ATTR_LINK_RE.test(normalized)
}

function matchesEntityComparison(input: DetectorInput): boolean {
  const normalized = input.normalized
  if (YEAR_RE.test(normalized)) return false

  if (VS_SPLIT_RE.test(normalized)) {
    const parts = normalized.split(VS_SPLIT_RE)
    if (
      containsEntityText(parts[0] ?? '') ||
      containsEntityText(parts[1] ?? '')
    ) {
      return true
    }
  }

  if (COMPARE_VERB_RE.test(normalized)) {
    return countDistinctEntities(input) >= 2
  }

  return false
}

const DETECTOR_RULES: DetectorRule[] = [
  {
    id: 'explicit-search-request',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.explicitSearchRequest,
    test: input =>
      !PAST_SEARCH_RE.test(input.normalized) &&
      !EXPLICIT_EXPLAIN_GUARD_RE.test(input.normalized) &&
      EXPLICIT_SEARCH_RE.test(input.normalized)
  },
  {
    id: 'news-recent-events',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.newsRecentEvents,
    test: input => matchesNews(input)
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
    test: input => matchesPricesWeather(input)
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
    id: 'named-entity-information',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.namedEntityInformation,
    entitySignal: true,
    test: input => matchesNamedEntityInformation(input)
  },
  {
    id: 'entity-attribute-query',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.entityAttributeQuery,
    entitySignal: true,
    test: input => matchesEntityAttribute(input)
  },
  {
    id: 'entity-comparison',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.entityComparison,
    entitySignal: true,
    test: input => matchesEntityComparison(input)
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
    suppressedByEntitySignal: true,
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
    id: 'supplied-text-transformation',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.suppliedTextTransformation,
    test: input => SUPPLIED_TEXT_RE.test(input.normalized)
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
    test: input =>
      CREATIVE_REQUEST_RE.test(input.normalized) ||
      FICTIF_RE.test(input.normalized)
  },
  {
    id: 'stable-knowledge',
    weight: WEB_SEARCH_DETECTOR_WEIGHTS.stableKnowledge,
    suppressedByStrongSignal: true,
    suppressedByEntitySignal: true,
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
    suppressedByEntitySignal: true,
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

  // Entity signals (info queries about a person/company/model) outweigh the
  // "stable knowledge" and follow-up negatives: asking about a named entity is
  // an implicit request for current information.
  const hasEntitySignal = matched.some(rule => rule.entitySignal)
  if (hasEntitySignal) {
    matched = matched.filter(rule => !rule.suppressedByEntitySignal)
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
