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
 * Guides Markdown image output. Consecutive image lines are rendered cleanly inline.
 */
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
When search results contain relevant images, show at most 3 directly in the response using Markdown image links in the form \`![descriptive alt text](image-url)\` — ONE IMAGE PER LINE — followed by a numbered Sources list with clickable links in the exact format \`1. [Short title — Site name](exact URL)\`. Never dump the full image result set.

Skip images for abstract or text-only topics. Never include irrelevant images or fabricate URLs. Image URLs must be copied verbatim from the search tool's images array; never guess, rewrite, or invent them. Reuse any provided title and description exactly, keep images in the tool's order, and omit unavailable metadata.
`
}

/**
 * Modern 2026 ChatGPT-style Intelligent UI response directives.
 * Delivers interactive quizzes with collapsible answers, clean tables, callouts,
 * and structured layouts natively in Markdown. Replaces legacy OpenUI code blocks.
 */
export function getChatGPTIntelligentUiPrompt(): string {
  return `
INTELLIGENT UI & RICH PRESENTATION (2026 CHATGPT STANDARD):
Structure and present your answer using modern, interactive, and beautifully styled Markdown.

1. INTERACTIVE QUIZZES, ASSESSMENTS & FLASHCARDS:
- When asked to create a quiz, trivia, or questions, format each question clearly with numbered headers and distinct options A), B), C), D).
- Provide the answer and its pedagogical explanation inside a native collapsible disclosure element:
  <details>
  <summary>💡 Voir la réponse et l'explication</summary>

  **Bonne réponse : [Option correcte]**

  *Explication :* [Explication claire, concise et pédagogique].
  </details>
- This allows the user to test their knowledge interactively without needing external plugins or broken UI cards.

2. STRUCTURED DATA & COMPARISONS:
- Present comparative data, specs, or options in clean Markdown tables with aligned columns and visual cues (✅, ❌, ⚠️, ⚡).

3. CALLOUTS & KEY TAKEAWAYS:
- Highlight critical takeaways, warnings, or tips using GitHub-style blockquote callouts:
  > [!NOTE]
  > [Remarque utile ou contexte pertinent]

  > [!TIP]
  > [Conseil pratique ou recommandation]

4. STEP-BY-STEP WORKFLOWS & PLANS:
- Structure multi-step processes or itineraries with numbered bold sections and clear bullet points.

5. STRICT CODE & FORMAT RULE:
- NEVER generate \`\`\`openui code blocks, openui-lang code, or fake JSON UI specs in the chat response.
- All visual, structural, and interactive elements MUST be delivered in native, beautiful Markdown that renders instantly and cleanly.
`
}

/**
 * Adds natural, clean ChatGPT-style follow-up question suggestions
 * to substantive answers without ugly pseudo-code blocks.
 */
export function getChatGPTRelatedQuestionsPrompt(): string {
  return `
RELATED QUESTIONS & NEXT STEPS:
After your substantive answer or conclusion, provide exactly 3 concise, highly relevant follow-up questions or next steps in the user's language. Format them cleanly as a stylized bullet list:

---
### 💡 Suggestions de questions suivantes :
- **[Angle ou détail]** : [Une question précise approfondissant un point clé]
- **[Action pratique]** : [Une étape suivante concrète ou mise en pratique]
- **[Perspective élargie]** : [Une comparaison ou un sujet connexe pertinent]

Skip follow-ups entirely for greetings, small talk, thanks, simple one-line lookups, and clarification requests.
NEVER wrap follow-up questions in \`\`\`openui or any code block. Always format them in clean Markdown.
`
}
