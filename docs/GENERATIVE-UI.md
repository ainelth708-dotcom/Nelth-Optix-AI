# Native generative UI

Nelth-IA keeps its existing `/api/chat` transport, selected-model routing, authentication, and chat persistence. On turns where the request explicitly asks for a visualization or a visual would materially help, the researcher adds a native-component instruction to the existing model prompt. Greetings, simple factual answers, translations, and other ordinary chat stay text-only.

Generated components use the existing fenced `spec` JSONL patch format. `lib/render/catalog.ts` validates component names and bounded props before `lib/render/registry.tsx` renders them. The UI uses the current React, Tailwind, shadcn-style controls, and theme tokens; generated values are data, never application code.

Supported native components:

- `Table`: responsive structured comparison/data table.
- `Chart`: accessible bar and line charts with selectable data points.
- `Diagram`: responsive ordered flow diagram.
- `Calculator`: editable inputs for a fixed set of safe arithmetic operations.
- `Simulation`: bounded slider for a fixed square, cube, or multiplication relationship.
- `InteractiveForm`: validated local fields whose explicit submit sends the answers through the existing chat.
- Existing layout components such as `Stack`, `Grid`, `Heading`, and `Button`.

The renderer does not execute generated HTML or JavaScript and does not support arbitrary host actions. Custom sandboxed UI and live maps are not enabled; maps require reliable location data and an approved data source. Malformed specs are rejected by the existing catalog validator while the assistant's text remains available.
