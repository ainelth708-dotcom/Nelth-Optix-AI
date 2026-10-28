import { ModelMessage, UIMessage } from 'ai'

import { type Message as DBMessage } from '@/lib/db/schema'
import { describeOpenUIContext } from '@/lib/openui/context'
import { foldText } from '@/lib/skills/text-fold'

// Interface matching the expected DB message input format
interface DatabaseMessageInput {
  role: DBMessage['role']
  parts: any // Using 'any' here as we don't know the exact structure expected by the database
}

/**
 * Converts a single message from AI SDK to a database-compatible message format
 * @param message - Message from AI SDK
 * @returns Database-compatible message object
 */
export function convertMessageForDB(
  message: ModelMessage
): DatabaseMessageInput {
  // Handle case where content might be a string, array, or null
  let parts: any

  if (message.content === null || message.content === undefined) {
    parts = []
  } else if (typeof message.content === 'string') {
    parts = [{ text: message.content }]
  } else if (Array.isArray(message.content)) {
    // For array content (common in assistant messages with tool calls)
    // Extract text parts and join them
    const textParts = message.content
      .filter(part => part.type === 'text')
      .map(part => ({ text: part.text }))

    if (textParts.length > 0) {
      parts = textParts
    } else {
      // If no text parts, use the first part's content or stringify the whole content
      parts = [{ text: JSON.stringify(message.content) }]
    }
  } else {
    // Fall back to JSON string for other content types
    parts = [{ text: JSON.stringify(message.content) }]
  }

  return {
    role: message.role,
    parts: parts
  }
}

/**
 * Converts an array of messages from AI SDK to database-compatible message format
 * @param messages - Array of messages from AI SDK
 * @returns Array of database-compatible message objects
 */
export function convertMessagesForDB(
  messages: ModelMessage[]
): DatabaseMessageInput[] {
  return messages.map(convertMessageForDB)
}

/**
 * Extract the first text content from a message for use as a title
 * @param message - Message from AI SDK
 * @param maxLength - Maximum title length to extract
 * @returns Extracted title string, truncated to maxLength
 */
export function extractTitleFromMessage(
  message: ModelMessage,
  maxLength = 100
): string {
  if (!message.content) return 'New Chat'

  if (typeof message.content === 'string') {
    return message.content.substring(0, maxLength)
  }

  // For array content, try to find text parts
  if (Array.isArray(message.content)) {
    const textPart = message.content.find(part => part.type === 'text')
    if (textPart && 'text' in textPart) {
      return textPart.text.substring(0, maxLength)
    }
  }

  return 'New Chat'
}

/**
 * Extracts text content from UIMessage parts.
 * @param parts Array of message parts to extract text from.
 * @returns Concatenated text content or empty string if no text content is found,
 *          if 'message' or 'message.parts' is undefined, or if 'parts' is empty or contains no text parts.
 */
export function getTextFromParts(parts?: UIMessage['parts']): string {
  return (
    parts
      ?.filter(part => part.type === 'text')
      .map(part => describeOpenUIContext(part.text))
      .join(' ') ?? ''
  )
}

/**
 * Returns the URL of an image found in a message's parts, used to force the
 * image-to-image route of the `generateImage` tool so an uploaded/pasted photo
 * is restyled in place rather than triggering a text-to-image generation.
 *
 * Detects:
 *  - `file` parts with `mediaType` starting with `image/` (standard upload)
 *  - AI SDK `image` parts
 *  - inline `data:image/...` URLs (e.g. a pasted screenshot)
 */
export function getImageAttachmentUrl(parts?: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined
  for (const part of parts as any[]) {
    if (!part || typeof part !== 'object') continue
    const url =
      typeof part.url === 'string'
        ? part.url
        : typeof part.data === 'string'
          ? part.data
          : typeof part.content === 'string'
            ? part.content
            : typeof part.file === 'string'
              ? part.file
              : ''
    // Accept any image indicator: an explicit image media type, a data:image
    // URL, or an image file extension on the name/URL. Uploads frequently
    // arrive with mediaType "application/octet-stream" or only a blob/remote
    // URL, so we must not rely solely on mediaType starting with "image/".
    const mediaType =
      typeof part.mediaType === 'string'
        ? part.mediaType
        : typeof part.mimeType === 'string'
          ? part.mimeType
          : typeof part.type === 'string' && part.type.startsWith('image/')
            ? part.type
            : ''
    const name =
      typeof part.filename === 'string'
        ? part.filename
        : typeof part.name === 'string'
          ? part.name
          : ''
    const isImage =
      mediaType.startsWith('image/') ||
      url.startsWith('data:image/') ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name) ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)
    if (isImage && url) return url
  }
  return undefined
}

// Matches a request that wants to EDIT / RESTYLE / TRANSFORM an existing image
// (often one shown in a previous turn) rather than generate a new one.
const IMAGE_EDIT_REF_RE =
  /\b(restyle|restyl|transform|edit|change|modify|rework|turn|convert|refais|refaire|modifie|chang|transforme|recadre|recadrer|met(s)? (ca|cet|ce|it|that|this) en|en version|cartoon|anime|looney|toon|style)\b/i

/**
 * Find an image to use for image-to-image when the user references an image that
 * lives elsewhere in the conversation (e.g. "restyle this", "turn that into a
 * cartoon") without re-uploading it. Only returns a URL when the latest user
 * message clearly asks to EDIT/TRANSFORM an image — otherwise returns undefined
 * so a plain text-to-image request is never hijacked by a stale image.
 */
export function getReferencedImageUrl(
  messages?: { parts?: unknown[] }[],
  latestUserQuery?: string
): string | undefined {
  if (!Array.isArray(messages) || !latestUserQuery) return undefined
  if (!IMAGE_EDIT_REF_RE.test(latestUserQuery)) return undefined
  // Scan from newest to oldest so we pick the most recent relevant image.
  for (let i = messages.length - 1; i >= 0; i--) {
    const u = getImageAttachmentUrl(messages[i]?.parts)
    if (u) return u
  }
  return undefined
}

/**
 * Merges two UIMessage objects by combining their parts
 * @param primaryMessage The main message (properties from this will be preserved)
 * @param secondaryMessage The message whose parts will be merged into the primary message
 * @returns A new UIMessage with combined parts
 */
export function mergeUIMessages(
  primaryMessage: UIMessage,
  secondaryMessage: UIMessage
): UIMessage {
  return {
    ...primaryMessage,
    parts: [...primaryMessage.parts, ...secondaryMessage.parts]
  }
}

/**
 * Checks if a UIMessage contains tool calls
 * @param message The message to check for tool calls
 * @returns true if the message contains tool calls, false otherwise
 */
export function hasToolCalls(message: UIMessage | null): boolean {
  if (!message || !message.parts) return false

  return message.parts.some(
    part =>
      part.type && (part.type.startsWith('tool-') || part.type === 'tool-call')
  )
}

// Fake XML tool-call blocks the weak non-thinking model emits as text instead of
// native tool calls. These leak into the final answer and are rendered as raw
// <tool_call>…</tool_call> or <tool_calls:id>… markup. Strip them completely so the
// user never sees them.
const FAKE_TOOL_PATTERNS = [
  /<tool_calls?\b[^>]*>[\s\S]*?(?:<\/tool_calls?\b[^>]*>|<\/invoke\b[^>]*>|(?=<tool_calls?\b)|$)/gi,
  /<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call\b[^>]*>|<\/invoke\b[^>]*>|(?=<tool_calls?\b)|$)/gi,
  // Dots/Laguna style: <dots_function_call>…</dots_function_call> (and any
  // *_function_call variant the model may emit instead of native tool calls).
  /<[^>]*function_call[^>]*>[\s\S]*?<\/?[^>]*function_call[^>]*>/gi,
  /<\/?[^>]*function_call[^>]*\/?>/gi,
  // <invoke> / <function> only strip CLOSED blocks or attribute-carrying calls
  // (<invoke name="search">…). A bare unclosed tag is often legitimate prose
  // ("the <function> keyword") — deleting to end-of-answer would nuke a
  // correct response, which is worse than leaking a tag.
  /<invoke\b[^>]*>[\s\S]*?<\/invoke\s*>/gi,
  /<invoke\b[^>]*\b(?:name|id|tool|query|args?|params?)\b[^>]*>[\s\S]*?(?:<\/invoke\s*>|$)/gi,
  /<function\b[^>]*>[\s\S]*?<\/function\s*>/gi,
  /<function\b[^>]*\b(?:name|id|tool|query|args?|params?)\b[^>]*>[\s\S]*?(?:<\/function\s*>|$)/gi,
  /<tool-search\b[^>]*>[\s\S]*?(?:<\/tool-search>|$)/gi,
  // <search"> or <search ...> or <search>...</search> fake tool calls emitted by weak models
  /<search"[^>]*>[\s\S]*?<\/search\s*>/gi,
  /<search\b[^>]*>[\s\S]*?<\/search\s*>/gi,
  /<search"[^>\n]*>.*$/gim,
  /<search\b[^>\n]*>.*$/gim,
  /<\/?search"[^>]*>/gi,
  /<\/?search\b[^>]*\/?>/gi,
  /^[ \t]*<?search"?.*$/gim,
  // Lone tags: only unambiguous fake-tool syntax. Bare <invoke>/<function>
  // are legitimate prose far more often than tool calls, so they are left
  // alone here (closed/attribute-carrying blocks are handled above).
  /<\/?(?:tool_calls?|tool-search)\b[^>]*\/?>/gi,
  /<\/?tool_calls?(?::[a-zA-Z0-9_-]+)?[^>]*>/gi,
  // Dots3-Note style: <|tool_calls_section_begin|> … <|tool_calls_section_end|>
  // — chat-template tool-call markers emitted as TEXT when the model wants
  // native tools but the route runs without any. Strip the whole closed
  // section (payload included), then stray markers.
  /<\|(?:tool_calls_section_begin|tool_call_begin)\|>[\s\S]*?(?:<\|(?:tool_calls_section_end|tool_call_end)\|>|$)/gi,
  /<\|(?:tool_calls?_section_(?:begin|end)|tool_call_(?:begin|end))\|>/gi,
  // JSON-style fake tool calls the Dots model emits as text:
  // {"name":"gmail","parameters":{"operation":"list",...}}
  // Match a JSON object with "name" + ("parameters"|"input"|"args") keys.
  /\{"name"\s*:\s*"[^"]+"\s*,\s*"(?:parameters|input|args)"\s*:\s*\{[\s\S]*?\}\s*\}/g,
  // Fake search announcement lines: model writes text announcing search instead of calling the tool
  /^[ \t]*(?:(?:je\s+(?:fais|vais\s+(?:faire|effectuer)|lance|procède\s+[aà])\s+une\s+recherche(?:\s+web)?|recherche\s+(?:web\s+)?en\s+cours|searching\s+the\s+web\s+for|let\s+me\s+search\s+(?:the\s+web\s+)?for|je\s+recherche\s+(?:des\s+informations\s+)?(?:sur|pour)|nous\s+allons\s+(?:rechercher|faire\s+une\s+recherche))[^\n]*)[.:]?[ \t]*$/gim,
  /^[ \t]*\[\s*(?:recherche(?:\s+web)?|search|searching)\s*:[^\]]*\][ \t]*$/gim,
  /^[ \t]*recherche\s+web\s*:\s*.*$/gim
]

export function stripFakeToolCallXml(text: string): string {
  if (!text) return text
  let result = text
  for (const pattern of FAKE_TOOL_PATTERNS) {
    result = result.replace(pattern, '')
  }
  return (
    result
      .replace(/^[ \t]*<?search"?.*$/gim, '')
      .replace(/<search">.*$/gim, '')
      .replace(/<search\b[^>]*>.*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      // Strip blank LINES at the edges only — never .trim(): streaming deltas
      // carry meaningful leading/trailing spaces (" world") and trimming them
      // glues words together ("Helloworld").
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
  )
}

/**
 * Extracts a fake search query that a weak model attempted to emit as text,
 * e.g. `<search"> Mickael président Madagascar président de Madagascar actuel 2026`
 * or `<search query="Mickael président">` or `<tool_call name="search">{"query":"..."}`.
 */
export function extractFakeSearchQuery(text: string): string | null {
  if (!text) return null
  // Match <search"> query
  const searchQuoteMatch = text.match(/<?search">\s*([^<\n]+)/i)
  if (searchQuoteMatch && searchQuoteMatch[1]?.trim()) {
    return searchQuoteMatch[1].trim()
  }
  // Match <search query="..."> or <search q="...">
  const searchAttrMatch = text.match(
    /<search\b[^>]*\b(?:query|q)=["']([^"']+)["']/i
  )
  if (searchAttrMatch && searchAttrMatch[1]?.trim()) {
    return searchAttrMatch[1].trim()
  }
  // Match <search>query</search>
  const searchTagMatch = text.match(/<search\b[^>]*>([^<]+)<\/search>/i)
  if (searchTagMatch && searchTagMatch[1]?.trim()) {
    return searchTagMatch[1].trim()
  }
  // Match <invoke name="search">... or <invoke tool="search">...
  const invokeMatch = text.match(
    /<invoke\b[^>]*\b(?:name="search"|tool="search")[^>]*>([\s\S]*?)<\/invoke>/i
  )
  if (invokeMatch && invokeMatch[1]?.trim()) {
    try {
      const parsed = JSON.parse(invokeMatch[1].trim())
      if (typeof parsed.query === 'string' && parsed.query.trim()) {
        return parsed.query.trim()
      }
    } catch {
      return invokeMatch[1].replace(/[{}"']/g, '').trim()
    }
  }
  // Match <tool_call> or <tool_calls> containing search
  const toolCallMatch = text.match(
    /<tool_calls?\b[^>]*>([\s\S]*?)(?:<\/tool_calls?>|$)/i
  )
  if (toolCallMatch && toolCallMatch[1]?.trim()) {
    const block = toolCallMatch[1].trim()
    try {
      const parsed = JSON.parse(block)
      const q =
        parsed.arguments?.query ||
        parsed.input?.query ||
        parsed.parameters?.query ||
        parsed.query
      if (typeof q === 'string' && q.trim()) return q.trim()
    } catch {
      const queryPropMatch = block.match(/"query"\s*:\s*"([^"]+)"/i)
      if (queryPropMatch && queryPropMatch[1]?.trim()) {
        return queryPropMatch[1].trim()
      }
    }
  }
  // Match JSON-style fake tool call: {"name":"search",...}
  const jsonToolMatch = text.match(
    /\{"name"\s*:\s*"search"\s*,\s*"(?:parameters|input|args|arguments)"\s*:\s*\{[\s\S]*?"query"\s*:\s*"([^"]+)"/i
  )
  if (jsonToolMatch && jsonToolMatch[1]?.trim()) {
    return jsonToolMatch[1].trim()
  }
  // Match <tool_call:search> or <tool-search>
  const toolColonMatch = text.match(
    /<(?:tool_calls?:search|tool-search)\b[^>]*>([\s\S]*?)(?:<\/(?:tool_calls?(?::search)?|tool-search)>|$)/i
  )
  if (toolColonMatch && toolColonMatch[1]?.trim()) {
    const qMatch = toolColonMatch[1].match(/"query"\s*:\s*"([^"]+)"/i)
    if (qMatch && qMatch[1]?.trim()) return qMatch[1].trim()
  }
  // Match text-based search announcements: "Je fais une recherche sur ...", "Recherche web en cours : ...", "Searching the web for ..."
  const searchAnnounceMatch = text.match(
    /(?:recherche\s+web\s*(?:en\s+cours\s*)?:\s*|je\s+(?:fais|vais\s+(?:faire|effectuer)|lance)\s+une\s+recherche(?:\s+web)?\s+(?:sur|pour)\s+|je\s+recherche\s+(?:des\s+informations\s+)?(?:sur|pour)\s+|searching\s+the\s+web\s+for\s+|let\s+me\s+search\s+(?:the\s+web\s+)?for\s+)(["'«]?)([^.\n"'»]+)\1/i
  )
  if (searchAnnounceMatch && searchAnnounceMatch[2]?.trim()) {
    const q = searchAnnounceMatch[2].trim()
    if (q.length >= 2) return q
  }
  return null
}

export function stripFakeToolCallXmlFromMessage(message: {
  parts?: unknown[]
}): boolean {
  const parts = (message.parts as Array<{ type: string; text?: string }>) ?? []
  let changed = false
  for (const p of parts) {
    if (p.type === 'text' && typeof p.text === 'string') {
      const cleaned = stripFakeToolCallXml(p.text)
      if (cleaned !== p.text) {
        p.text = cleaned
        changed = true
      }
    }
  }
  return changed
}

/**
 * Tests the very START of a response: could this open with a greeting reset?
 * (Word boundaries matter: "hi" must not match "histoire".)
 */
const INTRO_START_RE =
  /^\s*(?:(?:bonjour|bonsoir|salut|coucou|hello|hey|hi)\b|👋|je suis nelth|qui suis-je|salama|manao ahoana|ravi\s+de|content\s+de|enchanté)/i

/**
 * Greeting/hook-led intro paragraph ("Salut ! 👋 Ravi de vous revoir.") —
 * always droppable mid-conversation while real content follows.
 */
const GREETING_HOOK_PARAGRAPH_RE =
  /^\s*(?:(?:bonjour|bonsoir|salut|coucou|hello|hey|hi)\b|👋|salama|manao ahoana|ravi(?:e)? de vous|content(?:e)? de vous|enchanté(?:e)?)/i

/**
 * Leading greeting sentences inside an intro paragraph ("Salut ! 👋 Ravi de
 * vous revoir. Voici ..."). Stripped sentence by sentence (up to 2) so a
 * paragraph that continues with real content keeps that content. The 👋
 * alternative also consumes an attached greeting sentence ("👋 Content de
 * vous voir — Python.") so the strip does not stop right after the emoji and
 * leave "Content de vous voir…" behind.
 */
const LEADING_GREETING_SENTENCES_RE =
  /^(?:\s*(?:(?:bonjour|bonsoir|salut|coucou|hello|hey|hi)\b[^.!?…\n]*[.!?…]?|👋+\s*(?:(?:ravi(?:e)? de vous|content(?:e)? de vous|enchanté(?:e)?)[^.!?…\n]*[.!?…]+)?|(?:ravi(?:e)? de vous|content(?:e)? de vous|enchanté(?:e)?)[^.!?…\n]*[.!?…]+)\s*){1,2}/i

/**
 * Self-intro-led paragraph ("Qui suis-je ? 🤖", "Je suis Nelth-IA, ...") — the
 * weak model replays the previous identity answer before the new one. Droppable
 * mid-conversation ONLY when the current question is NOT about identity
 * (see keepSelfIntro — a legit "qui es-tu ?" answer must survive).
 */
const SELF_INTRO_PARAGRAPH_RE =
  /^\s*(?:#{1,4}\s*)?(qui suis-je|je suis nelth|izaho dia nelth)/i

/**
 * True when the user's message asks about the assistant's identity
 * ("qui es-tu ?", "who are you", "présente-toi"...). Kept narrow on purpose:
 * "c'est qui X ?" (about someone else) must NOT count as identity.
 *
 * Tested on FOLDED text (lowercase, no diacritics) so every language matches
 * with or without accents: "quién eres" == "quien eres", "êtes" == "etes".
 * Covers French, English, Malagasy (the app's core locales) plus Spanish,
 * Portuguese, German and Italian identity phrasings — an identity question
 * must NEVER pay a web-search cost in any language.
 */
/**
 * Canonical identity phrases (folded + non-alphanumeric stripped) used for
 * the fuzzy phrase fallback. A query that is within edit distance <= 2
 * (for phrases >= 8 chars) or <= 1 (5-7 chars) of ANY template is treated
 * as identity. Gate: query must be <= 4 tokens AND <= 32 chars so
 * "qui est Elon Musk" (gap > 2 to every template) stays a real search.
 */
const IDENTITY_PHRASES = [
  // FR
  'quiestu', // qui es tu / qui est tu / qui est-tu
  'kuieasttu', // kui east tu (common typo)
  'tuesqui', // tu es qui / t'es qui / tu es koi
  'quetu', // qu'es tu (rare)
  'tueski', // tu es ki (phonetic)
  'tappelles', // tu t'appelles / tu tappelles
  'commenttuappelles', // comment tu t'appelles
  'presentetoi', // presente-toi / présente-toi
  'presentezvous', // presentez-vous
  'tonnom', // ton nom
  'votre nom', // votre nom
  'cestquoihnelth', // c'est quoi nelth
  'quiestnelth', // qui est nelth
  'cestquoihoptix', // c'est quoi optix
  'quiestoptix', // qui est optix
  'quitacreé', // qui t'a créé / qui t as créé
  // EN
  'whoareyou', // who are you
  'whoareyou', // who ar eyou (typo - same as above, duplicate OK)
  'whatareyou', // what are you
  'whatareyou', // what ar eyou (typo - duplicate OK)
  'whoareu', // who r u / who are u
  'whatareu', // what r u / what are u
  'whatsyourname', // what's your name / whats your name
  'yourname', // your name
  'whomadeyou', // who made you
  'whocreatedyou', // who created you
  'whobuiltyou', // who built you
  'whodevelopedyou', // who developed you
  'tellmeaboutyourself', // tell me about yourself
  'introduceyourself', // introduce yourself
  // ES
  'quienes', // quién eres / quien eres
  'comotellamas', // cómo te llamas
  'cualestunombre', // cuál es tu nombre
  'quemetecreo', // quién te creó
  'presentate', // preséntate
  // PT
  'quemevoce', // quem é você
  'comosechama', // como se chama
  'qualeseunome', // qual é o seu nome
  'quemtecriou', // quem te criou
  // DE
  'werbistdu', // wer bist du
  'wieheisstdu', // wie heißt du
  'werbistdu', // wer bist du
  // IT
  'chisei', // chi sei
  'cometichiami', // come ti chiami
  // MG
  'izaianao', // iza ianao
  'ianaoiza', // ianao iza
  'inonaianao', // inona ianao
  'anaranao', // ny anaranao / inona no anaranao
  // Model-identity questions ("quel model es-tu", "what model are you"...)
  'quelmodelestu', // quel model es-tu / quel modèle es-tu
  'tuesquelmodele', // tu es quel modèle
  'whatmodelareyou', // what model are you
  'whichmodelareyou', // which model are you
  'whatmodeldoyouuse', // what model do you use
  'areyougpt', // are you gpt
  'areyouchatgpt', // are you chatgpt
  'areyouanai', // are you an ai
  'quemodeloeres', // que modelo eres
  'welchesmodellbistdu', // welches modell bist du
  'chemodellosei', // che modello sei
  'modelinona' // model inona
]

// Model/self-identity questions ("quel model es-tu ?", "what model are you",
// "es-tu ChatGPT ?", "tu es basé sur quel modèle ?"...). The assistant's own
// model and engine are internal knowledge (INFO NELTH-IA) — they must never
// fire a web search, and they are served by the identity fast-path with zero
// latency (this check also skips the LLM search judge). Anchored on explicit
// self-reference (tu / vous / you / voce / du / sei / eres), so the pattern
// is safe on ANY query length; the generic identity regex below keeps its
// short-query guard. Tested against foldText() output (lowercase, no
// diacritics; apostrophes and hyphens preserved).
const MODEL_SELF_IDENTITY_RE = new RegExp(
  `\\b(?:` +
    // FR — "quel modèle es-tu / es tu / êtes-vous"
    `quel(?:le|les)?\\s+(?:modele?|llm|ia)\\s*(?:es|est|etes)[-\\s]*(?:tu|vous)|` +
    // "tu es quel modèle", "tu es IA", "tu es une IA", "tu es chatgpt"
    `tu\\s+(?:es|est)\\s+(?:quel(?:le)?\\s+)?(?:une?\\s+)?(?:modele?|llm|ia\\b|intelligence\\s+artificielle|gpt|chatgpt|claude|gemini|deepseek|mistral|llama|grok|copilot|openai)|` +
    // "t'es quel modèle", "t'es une IA", "t'es chatgpt"
    `t['’]es\\s+(?:quel(?:le)?\\s+)?(?:une?\\s+)?(?:modele?|llm|ia\\b|gpt|chatgpt|claude|gemini|deepseek)|` +
    // "vous êtes quel modèle", "vous êtes une IA", "vous êtes chatgpt"
    `vous\\s+etes\\s+(?:quel(?:le)?\\s+)?(?:une?\\s+)?(?:modele?|llm|ia\\b|gpt|chatgpt|claude|gemini|deepseek)|` +
    // "tu utilises quel modèle", "vous utilisez quel modèle", "tu tournes sur quel modèle"
    `(?:tu\\s+(?:utilise[s]?|t['’]utilise[s]?|tourne[s]?)|vous\\s+(?:utilisez|tournez))\\s+quel(?:le)?\\s+(?:modele?|llm)|` +
    // "quel modèle tu utilises", "quel modèle utilises-tu", "quel modèle utilisez-vous"
    `quel(?:le)?\\s+(?:modele?|llm)\\s+(?:tu\\s+utilise[s]?|vous\\s+utilisez|utilise[s]?[-\\s]?tu|utilisez[-\\s]?vous|tu\\s+tourne[s]?|tourne[-\\s]?tu)|` +
    // "tu es basé sur quel modèle", "tu es basé sur GPT", "vous êtes entraîné sur..."
    `(?:tu\\s+es|vous\\s+etes|t['’]es)\\s+(?:base[eé]?|entraine[eé]?)\\s+sur\\s+(?:quel(?:le)?\\s+)?(?:modele?|llm|ia\\b|gpt|chatgpt|claude|gemini|deepseek|mistral|llama|openai)|` +
    // "es-tu une IA", "êtes-vous ChatGPT", "es-tu un robot"
    `(?:es[-\\s]?tu|etes[-\\s]?vous)\\s+(?:une?\\s+)?(?:ia\\b|llm\\b|robot\\b|intelligence\\s+artificielle|gpt\\b|chatgpt|claude|gemini|deepseek|mistral|llama|grok|copilot|openai)|` +
    // EN — "what model are you", "which ai are you", "what version are you"
    `(?:what|which)\\s+(?:model|ai|llm|version)\\s+(?:are|r)\\s+(?:you|u)|` +
    // "what model do you use", "which model powers you", "what model are you running on"
    `(?:what|which)\\s+(?:model|llm)\\s+(?:do\\s+you\\s+use|you\\s+use|you\\s+using|are\\s+you\\s+(?:using|running|built|based)|powers?\\s+you|is\\s+behind\\s+you|you\\s+(?:run|running)\\s+on)|` +
    // "are you ChatGPT", "are you an AI", "r u gpt" ("are" anchor)
    `are\\s+(?:you|r\\s+u|u)\\s+(?:an?\\s+)?(?:ai\\b|llm\\b|robot\\b|gpt\\b|gpt-\\d|chatgpt|claude|gemini|deepseek|mistral|llama|grok|copilot|openai)|` +
    // "you are gpt", "you r chatgpt"
    `you\\s+(?:are|r)\\s+(?:gpt\\b|chatgpt|claude\\b|gemini|deepseek)|` +
    // "what are you powered by / built on / trained on"
    `what\\s+are\\s+you\\s+(?:powered|running|built|trained|based)\\s+(?:by|on|with)|` +
    // ES — "qué modelo eres", "eres ChatGPT", "con qué modelo funcionas"
    `que\\s+(?:modelo|ia\\b|inteligencia\\s+artificial)\\s+eres|` +
    `eres\\s+(?:gpt\\b|chatgpt|claude|gemini|deepseek|una?\\s+(?:ia\\b|inteligencia\\s+artificial))|` +
    `con\\s+que\\s+modelo\\s+(?:funcionas|estas\\s+hecho)|` +
    // DE — "welches modell bist du", "bist du gpt", "auf welchem modell basierst du"
    `welches\\s+(?:modell|ki)\\s+bist\\s+du|` +
    `bist\\s+du\\s+(?:gpt\\b|chatgpt|claude|gemini|deepseek|eine?\\s+ki\\b)|` +
    `auf\\s+welchem\\s+modell\\s+(?:basiert|basierst)|` +
    // PT — "qual modelo você é", "você é chatgpt", "qual ia você usa"
    `qual\\s+(?:modelo|ia\\b|inteligencia\\s+artificial)\\s+(?:voce\\s+e|e\\s+voce|voce\\s+usa|voce\\s+roda)|` +
    `voce\\s+(?:e|eh)\\s+(?:gpt\\b|chatgpt|claude|gemini|deepseek|uma\\s+(?:ia\\b|inteligencia\\s+artificial))|` +
    // IT — "che modello sei", "sei chatgpt", "sei un'ia"
    `che\\s+(?:modello|ia\\b)\\s+sei|` +
    `sei\\s+(?:gpt\\b|chatgpt|claude\\b|gemini|deepseek|un['’]?ia\\b)|` +
    // MG — "model inona", "inona no/ny model"
    `(?:inona\\s+(?:no|ny)\\s+model|model\\s+inona)` +
    `)\\b`,
  'i'
)

/**
 * TRUE when the query is an identity question (including typo'd short forms).
 * A dedicated model/self-identity class ("quel model es-tu", "what model are
 * you", "es-tu ChatGPT", "tu es basé sur quel modèle") runs FIRST at ANY
 * length — anchored on explicit self-reference, so it cannot hit third-person
 * questions. Then the strict regex (short queries only); if it fails AND the
 * query is short (<= 4 tokens, <= 32 chars), a bounded Levenshtein check
 * against canonical identity phrases runs. This catches "kui east tu",
 * "who ar eyou", "iza inao" while keeping "qui est Elon Musk" (distance > 2
 * to every template) as a real search.
 */
export function isIdentityQuery(query: string): boolean {
  if (!query) return false
  const qf = foldText(query)
  // Model/self-identity class: the assistant's own model/engine is internal
  // knowledge (INFO NELTH-IA) and must never fire a web search. Runs before
  // the short-query gate — the self-reference anchor makes it safe at any
  // length, and it doubles as the zero-latency fast-path that skips the LLM
  // search judge in both orchestrators.
  if (MODEL_SELF_IDENTITY_RE.test(qf)) return true
  const tokens = qf.trim().split(/\s+/)
  const normalized = qf.replace(/[^a-z0-9]/g, '')
  const isShort = tokens.length <= 4 && normalized.length <= 32
  // Strict regex — only for short queries to avoid "what are you doing" false positive
  if (
    isShort &&
    /\b(qui\s+(es|est|etes)[-\s]?tu|tu\s+(es|est)\s+qui|t['’]es\s+qui|qui\s+t['’]es|qui\s+etes[-\s]?vous|vous\s+etes\s+qui|dis[-\s]?moi\s+qui\s+tu\s+(es|est)|parle[-\s]?moi\s+de\s+toi|tu\s+te\s+nommes\s+comment|tu\s+t['’]appelles|tu\s+t['’]appelles\s+comment|comment\s+tu\s+t['’]appelles|vous\s+vous\s+appelez|tu\s+(es|est)\s+faits?\s+avec\s+quoi|tu\s+(es|est)\s+quoi|tu\s+sers\s+a\s+quoi|qui\s+t['’]a\s+(cree|concu|developpe|fait|programme)|qui\s+t['’]as\s+(cree|concu|developpe|fait|programme)|qui\s+vous\s+a\s+(cree|concu|developpe|fait)|qui\s+est\s+ton\s+(createur|concepteur|developpeur|programmeur|fabricant)|presente[-\s]?toi|presentez[-\s]?vous|ton\s+nom|votre\s+nom|c['’]est\s+quoi\s+nelth|qui\s+est\s+nelth|c['’]est\s+quoi\s+optix|qui\s+est\s+optix|who\s+are\s+you|who\s+r\s+u|who\s+ru|what\s+are\s+u|what\s+r\s+u|what\s+are\s+you|who\s+made\s+you|who\s+created\s+you|who\s+built\s+you|who\s+developed\s+you|what\s+is\s+your\s+name|whats\s+your\s+name|your\s+name\s+\?|tell\s+me\s+about\s+yourself|introduce\s+yourself|quien\s+eres|quien\s+eres\s+tu|quien\s+eres\s+tu\?|eres\s+quien|como\s+te\s+llamas|cual\s+es\s+tu\s+nombre|quien\s+te\s+(creo|hizo|desarrollo|programo)|presentate|quem\s+(e|es|sao)\s+voce|voce\s+e\s+quem|como\s+se\s+chama|qual\s+e\s+o\s+seu\s+nome|quem\s+te\s+criou|quem\s+fez\s+voce|wer\s+bist\s+du|du\s+bist\s+wer|wie\s+heisst\s+du|wer\s+sind\s+sie|wie\s+heissen\s+sie|wer\s+dich\s+(erstellt|gemacht|entwickelt)\s+hat|chi\s+sei|chi\s+sei\s+tu|come\s+ti\s+chiami|come\s+ti\s+chiami\s+\?|iza\s+ianao|ianao\s+iza|inona\s+ianao|iza\s+no\s+namorona\s+anao|iza\s+no\s+(anaranao|namanao)|ahoana\s+ny\s+anaranao|inona\s+ny\s+anaranao|inona\s+no\s+anaranao)\b/i.test(
      qf
    )
  ) {
    // Guard: reject if query has 4 tokens AND last token is alphabetic (not just punctuation)
    // This catches "what are you doing" (4 tokens, "doing" is alphabetic) vs "what are you ?" (4 tokens, "?" is punctuation)
    if (tokens.length === 4 && /[a-z]/.test(tokens[3])) {
      // fall through to fuzzy
    } else {
      return true
    }
  }
  // Fuzzy phrase fallback for short identity questions with typos
  if (!isShort) return false
  return IDENTITY_PHRASES.some(p => {
    // Tolerance scales with template length: floor(len/4), capped at 3
    const max = Math.min(3, Math.max(1, Math.floor(p.length / 4)))
    return editDistanceAtMost(normalized, p, max)
  })
}

/**
 * Deterministic last-resort identity answer for the streaming fallback path:
 * when the model produced ONLY a search announcement / fake search call on an
 * identity question, the orchestrator injects this direct answer instead of
 * running a live web search (an identity question never needs the web).
 * Short, honest and stable — it states only what the app itself guarantees
 * (Nelth-IA by Optix AI) and invites the user to ask for more detail.
 */
export function identityFallbackAnswer(lang?: string): string {
  switch (lang) {
    case 'en':
      return "I'm Nelth-IA, Optix AI's intelligent assistant. I can search the web, write and debug code, analyze documents (PDF, Word, Excel, PowerPoint), generate images and much more — just ask."
    case 'mg':
      return "Izaho dia Nelth-IA, ny mpanampy marani-tsaina avy amin'ny Optix AI. Afaka mitady vaovao, manoratra sy manamafa code, mandinika antontan-taratasy (PDF, Word, Excel, PowerPoint), mamorona sary ary maro hafa — anontanio fotsiny."
    case 'es':
      return 'Soy Nelth-IA, el asistente inteligente de Optix AI. Puedo buscar en la web, escribir y depurar código, analizar documentos (PDF, Word, Excel, PowerPoint), generar imágenes y mucho más — solo pregunta.'
    case 'de':
      return 'Ich bin Nelth-IA, der intelligente Assistent von Optix AI. Ich kann im Web suchen, Code schreiben und debuggen, Dokumente analysieren (PDF, Word, Excel, PowerPoint), Bilder erstellen und vieles mehr — frag einfach.'
    case 'it':
      return "Sono Nelth-IA, l'assistente intelligente di Optix AI. Posso cercare sul web, scrivere e correggere codice, analizzare documenti (PDF, Word, Excel, PowerPoint), generare immagini e altro ancora — chiedi pure."
    case 'pt':
      return 'Sou o Nelth-IA, o assistente inteligente da Optix AI. Posso pesquisar na web, escrever e depurar código, analisar documentos (PDF, Word, Excel, PowerPoint), gerar imagens e muito mais — é só pedir.'
    default:
      return 'Je suis Nelth-IA, l’assistant intelligent d’Optix AI. Je peux chercher sur le web, écrire et corriger du code, analyser des documents (PDF, Word, Excel, PowerPoint), générer des images et bien plus — posez-moi votre question.'
  }
}

/**
 * Strips leading intro-fluff paragraphs (greeting reset + replayed self-intro)
 * from the START of an assistant answer, mid-conversation only. Paragraphs are
 * dropped one by one while MORE content follows — the response itself is never
 * nuked: if the whole text is just a greeting, it is kept as-is.
 * Self-intro paragraphs survive when keepSelfIntro is set (the user actually
 * asked "qui es-tu ?" — the intro IS the answer).
 */
export function stripLeadingIntroReset(
  text: string,
  opts?: { keepSelfIntro?: boolean; dropPureGreeting?: boolean }
): string {
  const keepSelfIntro = !!opts?.keepSelfIntro
  const dropPureGreeting = !!opts?.dropPureGreeting
  let out = text
  for (let i = 0; i < 4; i++) {
    const m = out.match(/^\s*([^\n]+(?:\n(?!\n)[^\n]*)*)/)
    if (!m) break
    const para = m[1]
    const rest = out.slice(m[0].length)
    // Last (or only) paragraph: never nuke a real answer. A reply that is
    // ENTIRELY greeting-reset fluff is kept by default (first-turn greetings
    // are legit) but dropped when dropPureGreeting is set — mid-conversation
    // with a non-greeting user message, showing it IS the reset bug, so the
    // empty-fallback/retry machinery takes over instead.
    if (rest.trim().length === 0) {
      const isFluff =
        para.length <= 600 &&
        (GREETING_HOOK_PARAGRAPH_RE.test(para) ||
          (!keepSelfIntro && SELF_INTRO_PARAGRAPH_RE.test(para)))
      if (!isFluff || !dropPureGreeting) break
      return ''
    }
    if (para.length > 600) break
    if (GREETING_HOOK_PARAGRAPH_RE.test(para)) {
      // Greeting-led paragraph: strip only the leading greeting sentences so
      // real content continuing in the same paragraph survives. If nothing
      // substantial remains, drop the paragraph as before.
      const remainder = para.replace(LEADING_GREETING_SENTENCES_RE, '').trim()
      if (remainder.length > 40) {
        out = `${remainder}\n\n${rest.replace(/^\s+/, '')}`
      } else {
        out = rest.replace(/^\s+/, '')
      }
      continue
    }
    if (!keepSelfIntro && SELF_INTRO_PARAGRAPH_RE.test(para)) {
      out = rest.replace(/^\s+/, '')
      continue
    }
    break
  }
  return out
}

/**
 * Stream sanitization context:
 * - `classic`: the legacy classic-route behavior — every legacy fake-call
 *   family, including the `<search …>` / attribute-carrying
 *   `<invoke|function>` heuristics the classic weak model is known to emit.
 * - `openui`: only the unambiguous fake families (dots-style
 *   `*_function_call`, `tool_calls?`, `tool-search`). OpenUI Lang programs
 *   are PascalCase component markup (`<SearchImage query="…"/>`), so
 *   lowercase-only recognition means legit component tags can never match,
 *   and the broad `<search>`/`/>`-style cleanup probes are skipped so the
 *   renderer receives the program exactly as generated.
 */
export type StreamSanitizerMode = 'classic' | 'openui'

/**
 * Confirmed fake tool-call families — never part of legitimate content:
 * - dots/Laguna style `*_function_call` variants
 *   (`<dots_function_call>…</dots_function_call>` …)
 * - `tool_call(s)` / `tool-search` blocks.
 * An opening tag from one of these flips the sanitizer into its suppressed
 * state; the payload (the fake args the weak model writes as plain text)
 * is held until the matching closing tag.
 */
const FAKE_OPEN_TAG_RE =
  /<[a-z0-9_-]*function_call[^>]*>|<(?:tool_calls?|tool-search)\b[^>]*>|<\|(?:tool_calls_section_begin|tool_call_begin)\|>/i
const FAKE_CLOSE_TAG_RE =
  /<\/[a-z0-9_-]*function_call[^>]*>|<\/(?:tool_calls?|tool-search)\b[^>]*>|<\|(?:tool_calls_section_end|tool_call_end)\|>/i

/**
 * Classic-route extra families: any `<search …>` open tag (including the
 * `<search">` beast — the legacy patterns line-strip it at release time),
 * and attribute-carrying `<invoke|function>` calls. Bare `<invoke>` /
 * `<function>` prose ("the <function> keyword") must NOT trigger suppression.
 */
const FAKE_CLASSIC_OPEN_RE =
  /<search\b[^>\n]*>|<(?:invoke|function)\b[^>]*\b(?:name|id|tool|query|args?|params?)\b[^>]*>/i
const FAKE_CLASSIC_CLOSE_RE = /<\/(?:invoke|function|search)\s*>/i

/**
 * A trailing "<…" fragment that may still grow into a fake tool tag shot has
 * to be HELD, never emitted (legacy behavior for the known families, extended
 * to dots-style names the legacy prefix list missed — `<dots_function_…`):
 * 1. a name-like run with no '>' yet — `<dots_function_`, `</tool_`, `<s`…
 * 2. a complete family name with attributes in flight
 *    (`<tool_call name="search"` — held until '>' or a newline, as before).
 * Anything else (spaces, uppercase, `:`/`/` — URLs, `<`, PascalCase
 * components…) stops matching and streams out normally.
 */
const PARTIAL_FAKE_NAME_RE = /^<\/?[a-z0-9_-]*$/
const PARTIAL_FAKE_ATTRS_RE =
  /^<\/?[a-z0-9_-]*function_call[^>\n]*$|^<\/?(?:tool_calls?|tool-search|invoke|function|search)\b[^>\n]*$|^<\|[a-z_|]{0,80}$/i

/**
 * Memory bound for the suppressed-payload buffer. NOT a correctness
 * mechanism: suppression ends on the closing tag or on an abandoned-tag
 * recovery (paragraph boundary); this cap only guarantees buffering cannot
 * grow forever when a pathological stream feeds lowercase sludge with
 * neither. Real fake payloads are short query/JSON one-liners, orders of
 * magnitude below this bound.
 */
const MAX_SUPPRESSED_BUFFER_CHARS = 8192

/**
 * Memory bound for the held unresolved partial tag (see drain step 3). NOT a
 * correctness mechanism: a real tag resolves on '>' (or a newline) far below
 * this; the bound only guarantees holding cannot grow forever.
 */
const MAX_PARTIAL_TAG_CHARS = 2048

/**
 * Real-time streaming sanitizer to strip fake tool-call pseudo-XML tokens
 * as text chunks arrive from the model during SSE streaming.
 */
export class StreamTextSanitizer {
  private buffer = ''
  private stripIntro: boolean
  private keepSelfIntro: boolean
  private dropPureGreeting: boolean
  private introChecked = false
  private head = ''
  private mode: StreamSanitizerMode
  /**
   * Suppressed state: a confirmed fake tool-call OPEN tag was seen and
   * everything after it is that fake call's tool-args payload — never
   * user-visible. Held across arbitrarily many deltas until:
   * 1. the matching closing tag arrives — payload dropped, suppression
   *    lifts, trailing legit text resumes normal streaming; or
   * 2. the open tag proves abandoned (a paragraph boundary `\n\n` after a
   *    single-line fake payload, meaning the model moved on to real prose
   *    without ever closing) — payload dropped, text after it streams; or
   * 3. the memory cap above is hit (no close, no `\n\n`) — release cleaned,
   *    never silently discard an entire answer.
   */
  private suppressed = false

  constructor(opts?: {
    stripLeadingIntroReset?: boolean
    /** Raw user query: a legit identity question protects the self-intro. */
    userQuery?: string
    /**
     * Drop a reply that is ENTIRELY greeting-reset fluff (mid-conversation,
     * non-greeting user message) instead of releasing it at flush. The
     * orchestrators compute this from the conversation state.
     */
    dropPureGreeting?: boolean
    /**
     * Text-streaming context (see StreamSanitizerMode). Defaults to
     * `classic` so every existing call site keeps its exact behavior.
     */
    mode?: StreamSanitizerMode
  }) {
    this.stripIntro = !!opts?.stripLeadingIntroReset
    this.keepSelfIntro = isIdentityQuery(opts?.userQuery ?? '')
    this.dropPureGreeting = !!opts?.dropPureGreeting
    this.mode = opts?.mode ?? 'classic'
  }

  /**
   * Processes an incoming text delta. Returns the sanitized text delta
   * safe to immediately stream to the client.
   */
  process(delta: string): string {
    // Greeting-reset enforcement: hold the very start of the stream until we
    // can decide whether it opens with intro fluff.
    if (this.stripIntro && !this.introChecked) {
      this.head += delta
      // Fast path: enough text and clearly not an intro reset → stream now.
      if (this.head.length >= 30 && !INTRO_START_RE.test(this.head)) {
        const incoming = this.head
        this.head = ''
        this.introChecked = true
        this.buffer += incoming
      } else {
        const decisive = this.head.includes('\n\n') || this.head.length >= 1200
        if (!decisive) return ''
        const stripped = stripLeadingIntroReset(this.head, {
          keepSelfIntro: this.keepSelfIntro,
          dropPureGreeting: this.dropPureGreeting
        })
        if (
          stripped === this.head &&
          INTRO_START_RE.test(this.head) &&
          this.head.length < 1200
        ) {
          // Opening is intro fluff but real content hasn't arrived yet —
          // keep holding so the greeting never flashes on screen. flush()
          // will release it if nothing else ever comes.
          return ''
        }
        this.head = ''
        this.introChecked = true
        if (!stripped) return ''
        this.buffer += stripped
      }
    } else {
      this.buffer += delta
    }

    return this.drain()
  }

  /**
   * Drains the current buffer through the fake-tool-call state machine.
   * Split from process() so the suppressed-state flow can recurse back into
   * it after a closing tag or an abandoned-tag recovery.
   */
  private drain(): string {
    // 1. Suppressed state: everything after a confirmed fake open tag is
    //    that fake call's payload — hold it across deltas until the closing
    //    tag or an explicit recovery trigger (see `suppressed`). Payload
    //    text is tool args, never a user-visible answer.
    if (this.suppressed) {
      const close =
        this.mode === 'classic'
          ? (FAKE_CLOSE_TAG_RE.exec(this.buffer) ??
            FAKE_CLASSIC_CLOSE_RE.exec(this.buffer))
          : FAKE_CLOSE_TAG_RE.exec(this.buffer)
      if (close && close.index !== undefined) {
        // The fake block closed: drop its whole payload and resume normal
        // processing of whatever follows it (another block may trail).
        this.buffer = this.buffer.slice(close.index + close[0].length)
        this.suppressed = false
        return this.drain()
      }
      // Abandoned open tag: the model never wrote a closing tag and moved on
      // to real prose. Fake payloads are short single-line query/JSON blobs,
      // so a paragraph boundary deterministically marks the payload's end:
      // drop the payload, stream on from there so a valid answer is never
      // swallowed because of one stray tag.
      const blankLine = this.buffer.indexOf('\n\n')
      if (blankLine !== -1) {
        this.buffer = this.buffer.slice(blankLine)
        this.suppressed = false
        return this.drain()
      }
      // Memory bound only (MAX_SUPPRESSED_BUFFER_CHARS): no closing tag and
      // no paragraph boundary in sight. Release cleaned so buffering can
      // never grow unbounded, with the leftover markup stripped.
      if (this.buffer.length > MAX_SUPPRESSED_BUFFER_CHARS) {
        const cleaned = stripFakeToolCallXml(this.buffer)
        this.buffer = ''
        this.suppressed = false
        return cleaned
      }
      return ''
    }

    // 2. A confirmed fake OPEN tag: everything from it onward is the fake
    //    call's payload — enter the suppressed state and release the safe
    //    text before the tag (the strip cleans any earlier closed blocks).
    //    A close tag already present in the same buffer is resolved right
    //    away so the trailing legit text streams in the same round.
    const open =
      this.mode === 'classic'
        ? (FAKE_OPEN_TAG_RE.exec(this.buffer) ??
          FAKE_CLASSIC_OPEN_RE.exec(this.buffer))
        : FAKE_OPEN_TAG_RE.exec(this.buffer)
    if (open && open.index !== undefined) {
      const before = this.buffer.slice(0, open.index)
      this.buffer = this.buffer.slice(open.index)
      this.suppressed = true
      const ahead = this.drain()
      return stripFakeToolCallXml(before) + ahead
    }

    // 3. Partial tag at the end of the buffer: never emit an unresolved tag
    //    prefix (see isPotentialFakeTag). The WHOLE unresolved tail is held
    //    — not released raw around the partial '<' — so the strip-release
    //    probes below still see it once it resolves; the legacy probe-first
    //    order let a partial tag dodge the strip and leak chunk by chunk
    //    (stripFakeToolCallXml cannot strip an incomplete tag).
    const lastOpenBracket = this.buffer.lastIndexOf('<')
    const potentialTag =
      lastOpenBracket !== -1 && !this.buffer.includes('>', lastOpenBracket)
        ? this.buffer.slice(lastOpenBracket)
        : ''
    if (potentialTag && this.isPotentialFakeTag(potentialTag)) {
      // Memory valve only (not a correctness mechanism): a fake tag resolves
      // on '>' (or a newline); pathological sludge with neither must not
      // buffer forever.
      if (this.buffer.length > MAX_PARTIAL_TAG_CHARS) {
        const cleaned = stripFakeToolCallXml(this.buffer)
        this.buffer = ''
        return cleaned
      }
      return ''
    }

    // 4. JSON-style fake tool call ({"name":"gmail","parameters":{…}}) plus
    //    the legacy classic-route hygiene probes (leftover close-only fake
    //    markup, the `/>` debris…). Classic-only: OpenUI Lang legitimately
    //    contains self-closing PascalCase components, which that broad
    //    filter must never touch.
    const hasJsonFakeTool =
      /"name"\s*:\s*"[^"]+"\s*,\s*"(?:parameters|input|args)"\s*:\s*\{/.test(
        this.buffer
      ) && this.buffer.includes('}')
    const hasLoneFakeClose =
      FAKE_CLOSE_TAG_RE.test(this.buffer) ||
      (this.mode === 'classic' && FAKE_CLASSIC_CLOSE_RE.test(this.buffer))
    if (
      hasJsonFakeTool ||
      hasLoneFakeClose ||
      (this.mode === 'classic' && this.hasLegacyFakeMarkup())
    ) {
      const cleaned = stripFakeToolCallXml(this.buffer)
      this.buffer = ''
      return cleaned
    }

    // 5. Legacy classic heuristic: an unclosed bare fake-family tag still in
    //    flight (bare <search / <invoke …) — hold until it resolves.
    if (this.mode === 'classic' && this.hasUnclosedLegacyFakeTag()) {
      // If buffer is growing very large (> 300 chars) or has double newline, flush cleaned
      if (this.buffer.length > 300 || this.buffer.includes('\n\n')) {
        const cleaned = stripFakeToolCallXml(this.buffer)
        this.buffer = ''
        return cleaned
      }
      // Hold in buffer until the tag completes
      return ''
    }

    // 6. Partial JSON fake tool call: buffer starts with { and has "name" key
    // but no closing } yet — hold until the JSON completes so it can be
    // stripped in one shot on the next delta.
    if (
      this.buffer.trimStart().startsWith('{') &&
      /"name"\s*:/.test(this.buffer) &&
      !this.buffer.includes('}')
    ) {
      return ''
    }

    const output = this.buffer
    this.buffer = ''
    return output
  }

  /**
   * Could this trailing "<…" fragment still grow into one of the watched
   * fake tool tags? Two shapes are held, never emitted:
   * 1. a name-like run with no '>' yet — `<dots_function_`, `</tool_`,
   *    `<s`… (extends the legacy hold to dots-style names the old prefix
   *    list missed, which is exactly what leaked `dots_function_call` when
   *    the tag was split across streaming chunks);
   * 2. a complete family name with attributes still in flight
   *    (`<tool_call name="search"` …) — held until '>' or a newline,
   *    exactly like the legacy behavior for the same families.
   * Everything else (spaces, `:`/`/` in URLs, PascalCase components…)
   * stops matching and streams out normally.
   */
  private isPotentialFakeTag(potentialTag: string): boolean {
    if (PARTIAL_FAKE_NAME_RE.test(potentialTag)) return true
    if (PARTIAL_FAKE_ATTRS_RE.test(potentialTag)) return true
    return false
  }

  /**
   * Legacy classic-route hygiene probes — the verbatim legacy block, kept
   * byte-identical and now only called in classic mode (never on OpenUI
   * content, where self-closing PascalCase components are legitimate).
   */
  private hasLegacyFakeMarkup(): boolean {
    const hasClosedFakeTag =
      this.buffer.includes('</invoke>') ||
      this.buffer.includes('</tool_call>') ||
      this.buffer.includes('</tool_calls>') ||
      this.buffer.includes('</function>') ||
      this.buffer.includes('</tool-search>') ||
      this.buffer.includes('</search>') ||
      this.buffer.includes('<search">') ||
      this.buffer.includes('search">') ||
      (this.buffer.includes('<search') && this.buffer.includes('>')) ||
      this.buffer.includes('function_call') ||
      this.buffer.includes('<tool_call>') ||
      this.buffer.includes('<tool_calls>') ||
      this.buffer.includes('<tool-search>') ||
      this.buffer.includes('/>')

    // JSON-style fake tool call: {"name":"gmail","parameters":{...}}
    const hasJsonFakeTool =
      /"name"\s*:\s*"[^"]+"\s*,\s*"(?:parameters|input|args)"\s*:\s*\{/.test(
        this.buffer
      ) && this.buffer.includes('}')
    return hasClosedFakeTag || hasJsonFakeTool
  }

  /**
   * Legacy classic-route check for an UNCLOSED bare fake-family tag still
   * in flight (bare <search / <invoke …) — verbatim, classic-mode only.
   */
  private hasUnclosedLegacyFakeTag(): boolean {
    const hasOpenToolTag =
      this.buffer.includes('<tool_call') ||
      this.buffer.includes('</tool_call') ||
      this.buffer.includes('<tool_calls') ||
      this.buffer.includes('</tool_calls') ||
      this.buffer.includes('<invoke') ||
      this.buffer.includes('</invoke') ||
      this.buffer.includes('<function') ||
      this.buffer.includes('</function') ||
      this.buffer.includes('<tool-search') ||
      this.buffer.includes('</tool-search') ||
      this.buffer.includes('<search') ||
      this.buffer.includes('</search') ||
      this.buffer.includes('search">') ||
      this.buffer.includes('function_call')
    return hasOpenToolTag
  }

  /**
   * Flushes any remaining clean text at stream end. Each orchestrator owns
   * one sanitizer per stream attempt, so nothing here carries state into
   * another request.
   */
  flush(): string {
    // A confirmed fake open tag was never closed: everything buffered since
    // is that fake call’s payload, and an incomplete fake block must NOT be
    // flushed to the frontend as ordinary text — drop it. The two recovery
    // triggers in process() already guarantee real prose after an abandoned
    // tag is almost always released before flush.
    if (this.suppressed) {
      this.suppressed = false
      this.buffer = ''
    }
    const tail = this.buffer
    this.buffer = ''
    if (this.stripIntro && !this.introChecked) {
      const stripped = stripLeadingIntroReset(this.head + tail, {
        keepSelfIntro: this.keepSelfIntro,
        dropPureGreeting: this.dropPureGreeting
      })
      this.head = ''
      this.introChecked = true
      return stripFakeToolCallXml(stripped)
    }
    // Flush also runs stripFakeToolCallXml which handles JSON fake tool calls
    // and releases any still-held partial tag fragments.
    const remaining = stripFakeToolCallXml(tail)
    return remaining
  }
}

// Detect pure greetings / short chat messages that do NOT need web search.
// These are conversational turns where the model should answer immediately
// without any tool. Anything longer or more specific (even if it fails the
// strict intent regexes) should still get preloaded search for the weak
// model so it doesn't hallucinate [n] citations.
const PURE_GREETING_RE =
  /^\s*(bonjour|hello|hi|hey|salut|coucou|yo|salama|manao ahoana|ça\s+va|ca\s+va|comment\s+(ça|ca)\s+va|what'?s\s+up|how\s+are\s+you|comment\s+allez[- ]vous|merci|thanks|thx|ok|okay|oui|yes|no|non|d'?accord|noted|super|cool|great|bien|bienvenue|welcome|bye|au\s+revoir|bonne\s+(journée|nuit)|good\s+(morning|evening|night|afternoon))\s*[!?.?\s]*$/i

export function isPureGreeting(query: string): boolean {
  if (!query) return false
  const trimmed = query.trim()
  // Very short messages (< 25 chars) that match a greeting pattern
  if (trimmed.length > 40) return false
  return PURE_GREETING_RE.test(trimmed)
}

/**
 * Lexicon of greeting/chit-chat words used for FUZZY matching — short
 * words that are a small typo away from a greeting must not be treated as
 * entity lookups ("bonjoujr", "bonjor", "mersi"... are greetings, not
 * things to search the web for).
 * Extended with MG/common abbreviations: akory, manahoana, wesh, coucou.
 */
const GREETING_LEXICON = [
  'bonjour',
  'bonsoir',
  'salut',
  'coucou',
  'salama',
  'hello',
  'hey',
  'merci',
  'thanks',
  'bye',
  'bjr',
  'slt',
  'bsoir',
  'yo',
  'akory',
  'manahoana',
  'wesh'
]

/**
 * Bounded Levenshtein distance — true when the edit distance between the
 * two words is at most `max`. Early-exits on length gaps and on rows whose
 * minimum already exceeds `max` (words are tiny here, so this stays cheap).
 */
function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  const m = b.length
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i]
    let rowMin = i
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > max) return false
    prev = curr
  }
  return prev[m] <= max
}

/**
 * TRUE when the turn is a greeting or chit-chat EVEN WITH TYPOS. Extends
 * isPureGreeting (which stays exact/anchored for sanitizer semantics) with:
 *  - common greetings/abbreviations ("bjr", "slt", "bsoir"),
 *  - a fuzzy edit-distance match against the greeting lexicon (tolerance 2
 *    for words >= 5 chars, 1 for shorter ones) so "bonjoujr", "bonjor",
 *    "mersi", "sellut"... never look like a searchable entity.
 * Used to gate the automatic web search: a greeting-like turn must never
 * fire the standalone-entity-lookup preload or the search card UI.
 */
export function isGreetingLike(query: string): boolean {
  if (!query) return false
  const qf = foldText(query)
  const trimmed = qf.trim()
  if (!trimmed) return false
  const tokens = trimmed.split(/\s+/)
  // Only short conversational turns can be greeting-like: anything longer
  // than 4 words carries a real request ("bonjour et les prix du bitcoin
  // en 2026 ?" must keep searching). A greeting token inside a longer
  // sentence does not demote the sentence.
  if (tokens.length > 4) return false
  if (PURE_GREETING_RE.test(trimmed)) return true
  return tokens.some(w => {
    if (w.length < 2) return false
    const max = w.length >= 5 ? 2 : 1
    return GREETING_LEXICON.some(g => editDistanceAtMost(w, g, max))
  })
}

/**
 * Expands short follow-up search queries (e.g. "recherche leur image", "combien ça coûte ?")
 * with the subject/entities from previous conversation turns.
 */
export function resolveContextualSearchQuery(
  userQuery: string,
  history: UIMessage[] = []
): string {
  const q = userQuery.trim()
  if (!q) return ''

  let baseQuery = q

  const hasPronounOrFollowUp =
    /\b(leur|leurs|son|sa|ses|ça|ce|cet|cette|ces|eux|elle|elles|il|ils|lui|it|its|they|their|them|this|that|these|those|images?|photos?|pictures?|prix|combien|caract[eé]ristiques?|izy|azy|io|izay|ity|ireo|inona|iza|ahoana|nahoana|ataovy|amboary|hazavao|tohizo|avereno|eny)\b/i.test(
      q
    )

  if (
    history.length > 1 &&
    (hasPronounOrFollowUp || q.split(/\s+/).length <= 4)
  ) {
    const previousUserMessages = history
      .slice(0, -1)
      .filter(m => m.role === 'user')
    const lastUser = previousUserMessages[previousUserMessages.length - 1]
    if (lastUser) {
      const prevText = getTextFromParts(lastUser.parts).trim()
      if (prevText) {
        // Never merge with a pure greeting: "bonjour" then "Elon Musk" must
        // search "Elon Musk", NOT "bonjour Elon Musk" / "bonjour images".
        if (isPureGreeting(prevText)) {
          baseQuery = q
        } else {
          const cleanPrev = prevText
            .replace(
              /\b(cherche|recherche|trouve|search|find|show|montre|donne|donne-moi|give|mitady|trouve|qu'est[- ]ce|what\s+is|what\s+did|tell\s+me|about)\b/gi,
              ''
            )
            .replace(/[?!.]+$/, '')
            .trim()

          if (/\b(images?|photos?|pictures?|illustrations?)\b/i.test(q)) {
            // The query mentions images BUT may already carry its own subject
            // (e.g. "montre-moi une image d'Elon Musk"). In that case keep the
            // current query as-is — do NOT replace it with "<prev> images".
            if (hasOwnImageSubject(q)) {
              baseQuery = q
            } else {
              baseQuery = `${cleanPrev} images`
            }
          } else {
            baseQuery = `${cleanPrev} ${q}`
          }
        }
      }
    }
  }

  // Gemini-grade temporal grounding:
  // If the query asks for news, recent events, or relative dates ("aujourd'hui", "latest", "actualités"),
  // anchor with the current year (e.g. 2026) so fresh results are returned.
  const currentYear = new Date().getFullYear().toString()
  const isTemporalOrNews =
    /\b(news|actualit[eé]s?|actu|latest|derni[eè]res?\s+nouvelles?|derni[eè]res?\s+infos?|aujourd'?hui|ce\s+jour|ce\s+matin|cette\s+semaine|ce\s+mois|r[eé]cent|breaking)\b/i.test(
      baseQuery
    )
  if (isTemporalOrNews && !baseQuery.includes(currentYear)) {
    return `${baseQuery} ${currentYear}`
  }

  return baseQuery
}

/**
 * Returns true when an image-related query already names its own subject
 * (e.g. "image d'Elon Musk", "photos de la Tour Eiffel"). Strips command
 * verbs, image words and stopwords — if anything meaningful remains, the
 * subject is in the current query and history must NOT override it.
 */
function hasOwnImageSubject(query: string): boolean {
  const stopwords = new Set([
    'de',
    'des',
    'du',
    'la',
    'le',
    'les',
    'un',
    'une',
    'moi',
    'me',
    'te',
    'toi',
    'nous',
    'vous',
    'stp',
    'svp',
    'please',
    'avec',
    'with',
    'sur',
    'pour',
    'for',
    'the',
    'a',
    'an',
    'of',
    'et',
    'en',
    'une',
    'quelques',
    'quelque',
    'des',
    'ce',
    'cette',
    'ces',
    'cela',
    'celui',
    'celle',
    'ceux',
    'celles',
    'leur',
    'leurs',
    'son',
    'sa',
    'ses',
    'eux',
    'elle',
    'elles',
    'ils',
    'lui',
    'on',
    'mon',
    'ma',
    'mes',
    'ton',
    'ta',
    'tes',
    'ny',
    'sy',
    'dia',
    'fa',
    'ary',
    've',
    'ho',
    'ka',
    'izy',
    'azy',
    'io',
    'izay',
    'ity',
    'ireo'
  ])
  const cleaned = query
    .toLowerCase()
    .replace(
      /\b(cherche|recherche|chercher|trouve|trouver|montre(?:-moi)?|montrez|affiche|affichez|donne(?:-moi)?|donnez|veux|voir|search|find|show|give|get|mitady|tadiavo|tadiavina)\b/gi,
      ' '
    )
    .replace(
      /\b(images?|photos?|pictures?|illustrations?|visuels?|dessins?)\b/gi,
      ' '
    )
    .replace(/[’']/g, ' ')
    .replace(/[^a-zàâäéèêëîïôöùûüç0-9\s-]/gi, ' ')
  const meaningful = cleaned
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
  return meaningful.length > 0
}
