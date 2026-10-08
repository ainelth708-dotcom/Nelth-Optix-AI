/**
 * Nelth Agent — rules, architecture & design contract.
 *
 * Architecture (100% Vercel-compatible, stateless):
 *
 *   app/agent/page.tsx            → server entry, renders <AgentChat/>
 *   components/agent/agent-chat.tsx → ChatGPT-style UI (useChat + streaming)
 *   app/api/agent/chat/route.ts   → POST {messages} → streamText + tools → SSE
 *   agent/rules.ts (this file)    → system prompt, tool policy, limits
 *
 * Rules:
 * 1. No server-side state: every request carries its own history. Nothing is
 *    persisted (ephemeral, like guest chat). Safe for serverless scale-to-zero.
 * 2. Same providers and same guards as the main chat (auth, quotas, model
 *    selection). No new provider system, no hardcoded keys in the browser.
 * 3. Tools are READ-only and network-bound (all free, no API key): `web_search`,
 *    `weather` (Open-Meteo), `currency` (Frankfurter/BCE), `crypto` (CoinGecko),
 *    `dictionary`, `wikipedia`, `tech_news` (Hacker News), `github`, `arxiv`,
 *    plus pure `calculator`/`datetime` and one bounded `delegate_research`
 *    subagent. No shell, no filesystem writes, no destructive actions —
 *    nothing to approve, nothing that can harm a serverless function.
 * 4. The model must NEVER emit tool-call markup as text
 *    (<dots_function_call>, <invoke>, …): real calls go through the AI SDK
 *    tool loop; anything else is hallucination and is stripped client-side.
 * 5. Answers in the user's language (French by default), focused and sourced:
 *    every fact coming from `web_search` is cited with its URL.
 */

export const AGENT_NAME = 'Nelth Agent'

export const AGENT_MAX_HISTORY_TURNS = 20
export const AGENT_MAX_MESSAGE_CHARS = 4000
export const AGENT_MAX_STEPS = 4
export const AGENT_MAX_OUTPUT_TOKENS = 2000
export const AGENT_SEARCH_RESULTS = 8

export function buildAgentSystemPrompt(): string {
  return `You are ${AGENT_NAME}, the AI agent inside Nelth-IA. You work like ChatGPT but act like a real agent: plan, use tools, verify, then answer.
Answer in the user's language (French by default).
Your tools: web_search (live web facts — always cite each source with its full URL), weather (current + 5-day forecast for any city), currency (BCE rates conversion), crypto (USD prices), dictionary (English definitions), wikipedia (encyclopedia summaries), tech_news (Hacker News stories), github (public repo stats), arxiv (scientific papers), calculator (exact math, never compute by hand), datetime (current date/time), delegate_research (hand a deep or multi-angle research task to a specialist subagent and reuse its synthesis).
When a tool returns structured data, it is shown to the user as a rich card — briefly comment the result in your own words too.
Delegate when the question is complex, news-dependent, or needs several angles; do the simple lookups yourself with web_search.
You have NO other tools and NO code execution. NEVER emit XML or markup like <dots_function_call>, <invoke>, <parameter>, browser_navigate or similar: it is not executed and must never appear in your reply. Real calls go through your tool loop only.
Keep answers focused, structured with short headings or lists when it helps, and reasonably concise.`
}
