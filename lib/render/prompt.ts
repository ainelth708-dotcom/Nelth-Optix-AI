export function getGenerativeUiPrompt(): string {
  return `
ADAPTIVE NATIVE UI:
Choose a native interactive component only when the current request explicitly asks for one or it materially improves a complex comparison, data explanation, process, or calculation. A greeting, simple fact, translation, ordinary explanation, or short answer stays plain text.

For a useful visual, put one \`\`\`spec fenced block directly after the explanation. The block is JSONL containing RFC 6902 add operations, with one JSON object per line. Create a Stack root and add one or more components as its children. Keep all values grounded in the user's data or tool results; label estimates and assumptions. Never invent live data.

Available native components and props:
- Table: { title?: string, columns: string[], rows: string[][] }. Each row must have exactly one cell per column; maximum 8 columns and 30 rows.
- Chart: { title: string, chartType: "bar" | "line", values: { label: string, value: number }[] }. Maximum 16 points; use only supplied or verified values.
- Diagram: { title: string, steps: { label: string, description?: string }[] }. Use for a short ordered flow (2–12 steps).
- Calculator: { title: string, operation: "add" | "subtract" | "multiply" | "divide" | "percentOf", first: { label: string, value: number }, second: { label: string, value: number }, resultLabel: string }. Inputs are editable; percentOf means first × second ÷ 100.
- Simulation: { title: string, description?: string, operation: "square" | "cube" | "multiply", min: number, max: number, step: number, initialValue: number, factor?: number, outputLabel: string, unit?: string }. A bounded slider updates the stated mathematical relationship; multiply requires a fixed factor.
- InteractiveForm: { title: string, submitLabel: string, fields: { label: string, type: "text" | "number" | "select", required?: boolean, options?: string[] }[] }. A form submission is an explicit user action that sends the entered values as a chat follow-up; never use it to trigger consequential external actions.

Example for a requested chart:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"md"},"children":["chart"]}}
{"op":"add","path":"/elements/chart","value":{"type":"Chart","props":{"title":"Values provided by the user","chartType":"bar","values":[{"label":"A","value":12},{"label":"B","value":18}]},"children":[]}}
\`\`\`

Use only these registered components. Do not output HTML, JavaScript, executable code, event handlers, or arbitrary SVG. Invalid or unsupported visual content should be omitted while preserving the plain-text answer. A map is supported only when reliable location data is already available; do not imply a live map service.
`
}

/**
 * Returns the prompt section that instructs the LLM to output
 * related questions as a ```spec fenced block at the end of its response,
 * but only when follow-ups add value (skipped for greetings, trivial
 * lookups, and non-answers).
 */
export function getRelatedQuestionsSpecPrompt(): string {
  return `
RELATED QUESTIONS:
After your conclusion, generate exactly 3 follow-up questions in a \`\`\`spec fenced code block. This is expected on every substantive answer; only the narrow skip cases below are exempt.

MANDATORY FORMAT: The spec block MUST start with the exact line \`\`\`spec and end with \`\`\`. NEVER output the JSON lines as plain text without this fence. If you omit the fence, the questions will not render.

Include the spec block whenever the answer contains substantive information, analysis, comparison, or recommendations. Anchor each follow-up to concrete details from THIS answer.

SKIP the spec block entirely (output nothing) only in these cases:
- Greetings, small talk, or thanks ("hi", "thanks", "how are you").
- Trivial one-off lookups with no natural next step (simple math, a single fact, a yes/no).
- Meta/operational replies, acknowledgements, or task-completion notices.
- Cases where you could not answer (refusal, clarification request, or empty result).
- Short answers where suggested next questions would be generic or forced.
These skip cases are the exception. When the answer is substantive, include the spec block.

When you do include them, write the three questions a genuinely curious reader would tap next — not a checklist of "other aspects". Anchor each to THIS answer (use concrete names, options, or numbers from it), and make the three intents distinct:
- Deepen: go further on the single most interesting or surprising point.
- Act/decide: the practical next step (e.g. "How do I…", "Which … for …?").
- Broaden: a useful comparison, trade-off, or related angle.
Avoid three near-duplicate "what are the differences / what about X" questions.
Questions must be concise (max 10-12 words), self-contained, and in the user's language.

The spec block uses JSONL (one JSON object per line) with RFC 6902 JSON Patch operations.
Always include a Heading with title "Related" as the first child element.

Example output (only when related questions are valuable; place it at the very end of your response):

\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","questions"]}}
{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}
{"op":"add","path":"/elements/questions","value":{"type":"Stack","props":{"direction":"vertical","gap":"xs"},"children":["q1","q2","q3"]}}
{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"First follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"First follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q2","value":{"type":"Button","props":{"text":"Second follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Second follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q3","value":{"type":"Button","props":{"text":"Third follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Third follow-up question here"}}},"children":[]}}
\`\`\`

AVAILABLE COMPONENTS:
- Heading: { title: string, icon?: "related" | "arrow-right" } - A heading label with optional icon
- Stack: { direction?: "vertical" | "horizontal", gap?: "xs" | "sm" | "md" | "lg" } - Layout container
- Button: { text: string, icon?: "related" | "arrow-right", variant?: "default" | "outline" | "ghost" | "link" | "secondary" } - A clickable button that emits a press action. Use variant="link" with icon="arrow-right" for inline follow-up suggestions.

AVAILABLE ACTIONS:
- submitQuery: { query: string } - Submit a follow-up query

SPEC RULES:
1. If included, the related questions \`\`\`spec fence must appear at the END of your response, AFTER any <think> reasoning block (never inside it).
2. Every \`\`\`spec block must contain ONLY JSONL patches — no commentary inside.
3. Keep each JSON object on a single line.
4. The "text" prop and "query" param must be identical for each question.
5. Emit at most ONE related questions spec block per answer, and none at all when the skip criteria above apply (image spec blocks are separate and may appear inline).
6. Do NOT include follow-up suggestions or questions in your markdown text. Only use the spec block for them.
7. The "text" prop and "query" param MUST be PLAIN TEXT — no markdown, no links, no URLs. They render as clickable buttons, not as prose; a question written as a markdown link would display its brackets and parentheses literally. Write each question as a normal sentence.
`
}

/**
 * Returns the prompt section that instructs the LLM to optionally embed
 * inline image groups as ```spec fenced blocks within the response body.
 */
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
When search results contain images, show at most 3 relevant images directly in the markdown response
using image links in the form \`![descriptive alt text](image-url)\` — ONE IMAGE PER LINE, nothing else
on an image line — followed by a ChatGPT-style numbered « 📋 Sources » section with clickable links
in the EXACT format \`1. [Short title — Site name](exact URL)\` — NEVER raw URLs in text.
NEVER display all 20 images — pick only the best ones (2–3 maximum, fewer if less is relevant).
Do NOT output \`\`\`spec image blocks. The related-questions block, which is itself optional, remains
separate and must not be used for images.

Skip images only for genuinely abstract or text-only topics where no picture helps.
Never include irrelevant or decorative images, and never fabricate URLs.

AVAILABLE COMPONENTS FOR IMAGES:
- Grid: { columns: 1 | 2 | 3 | 4, gap?: "xs" | "sm" | "md" | "lg" } - A fixed-column container that reserves cell widths upfront so streaming images don't reflow.
- Image: { src: string, sourceUrl?: string, title?: string, description?: string, aspectRatio?: "1:1" | "16:9" | "4:3" }

  IMAGE LINK RULES:
1. Image URLs MUST be taken verbatim from the search tool's "images" array — NEVER fabricate, guess, or rewrite URLs.
2. The UI maps tool output fields to image metadata, copying values EXACTLY without rewording:
   - image.url → "src"
   - image.sourceUrl → "sourceUrl" (omit if not present in the tool output — do NOT invent)
   - image.title → "title" (omit if not present)
   - image.description → "description" (omit if not present)
3. The "aspectRatio" field SHOULD reflect the natural orientation of the subject: "1:1" for square (logos, portraits), "16:9" for wide (landscapes, scenes), "4:3" for standard photos. Images within the same Grid should generally use the SAME aspectRatio so they render at identical heights.
 4. Display at most 3 relevant images directly as Markdown image links, then a numbered Sources list
 of clickable links — NEVER raw URLs in text. Never dump the full 20-image set.
 5. Keep the images in the given IMG-number order — never reorder or mix them. Each caption reuses the
 provided title/description EXACTLY — never invent captions.
 6. NEVER put citation markers like [1][3] on the image intro sentence, captions, or Sources section.
 The linked sources are the attribution.
 7. Do not generate an image grid or hide the images behind a separate gallery component.

Example of the required direct format:

## Mount Fuji

![Mount Fuji at sunrise](https://example.com/mount-fuji.jpg)

📋 Sources :
1. [Mount Fuji at sunrise — Example](https://example.com/mount-fuji.jpg)
`
}
