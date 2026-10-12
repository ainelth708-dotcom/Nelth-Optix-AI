/**
 * E2E test: verify that an LLM emits a well-formed related questions spec
 * block for substantive answers while skipping it for trivial answers.
 *
 * This test hits a real LLM API and is therefore gated behind the
 * `RUN_LLM_E2E=1` environment variable. CI runs without the flag and the
 * test is skipped. To run locally:
 *
 *   RUN_LLM_E2E=1 OPENAI_API_KEY=sk-... bun run test llm-related-questions.e2e
 */
import { generateText, stepCountIs, tool } from 'ai'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import cloudConfig from '@/config/models/cloud.json'

import { getAdaptiveModePrompt } from '@/lib/agents/prompts/search-mode-prompts'
import { splitOpenUIResponses } from '@/lib/openui/response'
import { createSearchTool } from '@/lib/tools/search'
import { getModel } from '@/lib/utils/registry'

const RUN = process.env.RUN_LLM_E2E === '1'

// Mirror the deployed adaptive configuration. Emission is sensitive to the
// provider options (notably reasoning effort), so a run without them does not
// exercise what production does.
const ADAPTIVE = cloudConfig.models.adaptive
const MODEL =
  process.env.LLM_E2E_MODEL || `${ADAPTIVE.providerId}:${ADAPTIVE.id}`
const PROVIDER_OPTIONS = ADAPTIVE.providerOptions

const FIXTURE_RESULTS = [
  {
    title: 'Mount Fuji climbing routes',
    url: 'https://example.com/mount-fuji-routes',
    // Carries the answer to both queries below. Without the height, the trivial
    // test could pass because the model could not answer at all, which is a
    // separate skip case.
    content:
      'Mount Fuji stands 3,776 metres (12,389 ft) tall, making it the highest mountain in Japan. It has four main climbing routes. Yoshida is the most popular and has the most huts. Fujinomiya is the shortest but steepest. Subashiri starts below the tree line and joins Yoshida near the summit. Gotemba is the longest and least crowded. The official climbing season is generally July through early September.'
  }
]

function createMockSearchTool() {
  return tool({
    description: 'Search the web for information.',
    inputSchema: z.object({
      query: z.string(),
      type: z.enum(['optimized', 'general']).optional(),
      max_results: z.number().optional()
    }),
    async execute({ query }) {
      return {
        state: 'complete' as const,
        query,
        results: FIXTURE_RESULTS,
        images: [],
        number_of_results: FIXTURE_RESULTS.length,
        toolCallId: 'mock-search-1'
      }
    },
    toModelOutput: createSearchTool(MODEL).toModelOutput as never
  })
}

function findRelatedBlocks(markdown: string): string[] {
  return splitOpenUIResponses(markdown)
    .flatMap(segment => (segment.type === 'openui' ? [segment.content] : []))
    .filter(source => source.includes('FollowUpBlock'))
}

async function generateAnswer(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: getModel(MODEL),
    system: getAdaptiveModePrompt(),
    tools: {
      search: createMockSearchTool()
    },
    stopWhen: stepCountIs(6),
    providerOptions: PROVIDER_OPTIONS,
    prompt
  })

  return text
}

describe.skipIf(!RUN)('LLM related questions output (E2E)', () => {
  test('substantive answer includes three OpenUI follow-up items', async () => {
    const text = await generateAnswer(
      'Compare the main Mount Fuji climbing routes and recommend who each route suits.'
    )

    console.log('[E2E] Substantive model output:\n', text)

    const relatedBlocks = findRelatedBlocks(text)
    expect(relatedBlocks.length).toBeGreaterThanOrEqual(1)

    const items = relatedBlocks[0].match(/\b\w+\s*=\s*FollowUpItem\(/g) ?? []
    expect(items).toHaveLength(3)
  }, 120_000)

  test('trivial answer omits the related questions block', async () => {
    const text = await generateAnswer('How tall is Mount Fuji?')

    console.log('[E2E] Trivial model output:\n', text)

    expect(findRelatedBlocks(text)).toHaveLength(0)
  }, 120_000)
})
