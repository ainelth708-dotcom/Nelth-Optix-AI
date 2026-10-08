import { generateText, stepCountIs, tool, type LanguageModel } from 'ai'
import { z } from 'zod'

import { search as runWebSearch } from '@/lib/tools/search'

import {
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_SEARCH_RESULTS
} from './rules'

/**
 * Tool policy (hermes-style, Vercel-safe): every tool here is READ-only or
 * pure computation. No shell, no filesystem writes, no destructive actions —
 * so nothing needs human approval and nothing can harm a serverless function.
 * Search runs provider-side (same stack as the main chat), never raw fetch.
 */

function formatResults(
  results: Array<{ title?: unknown; url?: unknown; content?: unknown }>,
  maxCharsPerItem = 300
): string {
  const lines = results.slice(0, AGENT_SEARCH_RESULTS).map((item, i) => {
    const title = String(item.title ?? 'Sans titre')
    const url = String(item.url ?? '')
    const content = String(item.content ?? '').slice(0, maxCharsPerItem)
    return `${i + 1}. ${title} — ${content} (${url})`
  })
  return lines.length ? lines.join('\n') : 'No results.'
}

export function createWebSearchTool() {
  return tool({
    description:
      'Search the live web for fresh facts, news, prices, docs. Returns titles, snippets and URLs. Always cite sources used.',
    inputSchema: z.object({
      query: z.string().min(2).max(300).describe('The search query')
    }),
    execute: async ({ query }) => {
      try {
        const result = await runWebSearch(
          query,
          AGENT_SEARCH_RESULTS,
          'basic',
          [],
          [],
          ['web']
        )
        return formatResults(result.results ?? [])
      } catch {
        return 'Web search unavailable right now.'
      }
    }
  })
}

const CALC_SAFE_CHARS = /^[0-9+\-*/().,%\s^]*$/

export const calculatorTool = tool({
  description:
    'Evaluate a math expression (numbers, + - * / % ^, parentheses). No variables, no functions.',
  inputSchema: z.object({
    expression: z.string().min(1).max(200).describe('e.g. (120*3.5)/2')
  }),
  execute: async ({ expression }) => {
    const normalized = expression.replace(/\^/g, '**').trim()
    if (!CALC_SAFE_CHARS.test(normalized) || normalized === '') {
      return 'Invalid expression: only numbers and + - * / % ^ ( ) allowed.'
    }
    try {
      const value = new Function(`return (${normalized})`)() as unknown
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Could not evaluate this expression.'
      }
      return String(Math.round(value * 1e10) / 1e10)
    } catch {
      return 'Could not evaluate this expression.'
    }
  }
})

export const datetimeTool = tool({
  description: 'Current date and time (UTC and server local).',
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date()
    return `UTC: ${now.toISOString()} — Local: ${now.toString()}`
  }
})

const RESEARCHER_SYSTEM_PROMPT = `You are the Research specialist of Nelth Agent. Answer in the user's language (French by default).
Go deep with web_search: multiple angles, concrete facts, numbers, quotes. End with a compact synthesis and the source URLs. No other tools.`

/**
 * Delegation (OpenAI-Agents-SDK handoffs pattern, bounded): the main agent
 * hands a research task to a specialist that shares the same model. Depth is
 * capped at 1 — the specialist has no delegate tool, so no nesting.
 */
export function createDelegateResearchTool(model: LanguageModel) {
  return tool({
    description:
      'Delegate deep research to a specialist subagent (multi-angle web search + synthesis). Use for complex or news-dependent questions. Returns the synthesis.',
    inputSchema: z.object({
      task: z
        .string()
        .min(4)
        .max(1000)
        .describe('The research task, self-contained with context')
    }),
    execute: async ({ task }) => {
      try {
        const { text } = await generateText({
          model,
          system: RESEARCHER_SYSTEM_PROMPT,
          prompt: task,
          tools: { web_search: createWebSearchTool() },
          stopWhen: stepCountIs(3),
          maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS
        })
        return text.trim() === '' ? 'Research returned nothing.' : text
      } catch {
        return 'Research subagent unavailable right now.'
      }
    }
  })
}
