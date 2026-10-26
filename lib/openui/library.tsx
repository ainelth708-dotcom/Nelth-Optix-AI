/**
 * Nelth-IA OpenUI component library.
 *
 * Composes (never modifies) the vendored demo library with proprietary
 * components: the AI media generation card shares /imagine's pipelines
 * (Nelth-imagen V3, Nelth-omni video, image edit, image-to-video) inside
 * chat answers. Layout slots are `Node[]` (z.any) in the base library, so
 * no explicit slot placement is required.
 */
import { GenerateMediaCard } from '@/components/openui/generate-media-card'

import { library as baseLibrary } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/library'

export const library = baseLibrary.extend({
  components: { add: [GenerateMediaCard] }
})
