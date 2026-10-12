import { generateSystemPrompt } from '@openuidev/lang-core'

import { localPromptOptions } from '@/lib/openui/prompt-options'
import librarySpec from '@/lib/openui/spec.json'

export function getGenerativeUiPrompt(): string {
  const promptOptions = {
    ...localPromptOptions,
    additionalRules: [
      ...(localPromptOptions.additionalRules ?? []),
      'For a request that needs a visual response, return exactly one fenced block marked ```openui containing valid OpenUI Lang source generated from this library. Put the complete answer inside the OpenUI components; do not add prose or another block outside it. Do not output JSON patches, HTML, JavaScript, or components not in this library.',
      'Use interactive OpenUI for useful calculators, quizzes, planners, configurators, forms, comparisons, charts, tables, and diagrams. Use the library’s Form, Input, Slider, Select, Chips, OptionCards, Buttons, and Action components for user controls; make follow-up actions carry the user’s choices into the next answer.',
      'Use a chart or table only when the response has suitable data; clearly label estimates and never invent measured values. For ordinary explanations, greetings, and simple factual answers, prefer concise natural prose instead of a visual.',
      'For travel planning, sightseeing itineraries, or requests to show destinations on a map, use the Travel components in this library. Never create or link a separate HTML file for these requests.',
      'For visual answers with useful follow-ups, include FollowUpBlock as the final child of the same Card; do not add a second OpenUI block.'
    ]
  }

  return generateSystemPrompt({ library: librarySpec, promptOptions })
}

/**
 * Adds OpenUI Lang follow-up buttons to substantive answers while skipping
 * greetings, trivial lookups, and answers that need clarification.
 */
export function getRelatedQuestionsSpecPrompt(): string {
  return `
RELATED QUESTIONS:
After your conclusion, include exactly 3 concise follow-up questions when the answer contains substantive information, analysis, comparison, or recommendations. Skip follow-ups for greetings, thanks, trivial one-off facts, meta/operational replies, refusals, clarification requests, and answers where suggestions would be generic or forced.

Use this exact OpenUI Lang shape, replacing the sample questions with three useful, distinct questions in the user's language:

\`\`\`openui
root = Card([followUps])
followUps = FollowUpBlock([q1, q2, q3])
q1 = FollowUpItem("A concise question about a detail in this answer")
q2 = FollowUpItem("A concise practical next step")
q3 = FollowUpItem("A concise comparison or broader angle")
\`\`\`

If the answer itself is already an OpenUI response, add FollowUpBlock as the final child of its Card instead of creating another block. Otherwise, append this OpenUI block after the prose answer. Never output RFC 6902 patches or JSONL for follow-ups, and do not repeat the questions in prose.
`
}

/**
 * Guides Markdown image output. Consecutive image lines are converted to the
 * original OpenUI ImageGallery component before rendering.
 */
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
When search results contain relevant images, show at most 3 directly in the response using Markdown image links in the form \`![descriptive alt text](image-url)\` — ONE IMAGE PER LINE — followed by a numbered Sources list with clickable links in the exact format \`1. [Short title — Site name](exact URL)\`. Never dump the full image result set.

Skip images for abstract or text-only topics. Never include irrelevant images or fabricate URLs. Image URLs must be copied verbatim from the search tool's images array; never guess, rewrite, or invent them. Reuse any provided title and description exactly, keep images in the tool's order, and omit unavailable metadata. The UI groups consecutive Markdown images into the original OpenUI ImageGallery component; do not generate a separate HTML file or an image-only UI response.
`
}
