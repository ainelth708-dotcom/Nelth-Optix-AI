// Agent-facing skills bridge (open-agents-style lazy discovery).
//
// Lists the REAL skills from skills-main (frontmatter index) and loads a
// full SKILL.md body ONLY when the model invokes the `skill` tool —
// progressive disclosure, no context flooding. Same router/loader the
// researcher uses; nothing duplicated.
import { tool } from 'ai'
import { z } from 'zod'

import { loadSelectedSkillContent } from '@/lib/skills/loader'
import { getSkillRegistry } from '@/lib/skills/registry'

export interface AgentSkillSummary {
  id: string
  name: string
  description: string
}

/** Lightweight index for planners (id + one-line description each). */
export async function listAgentSkills(): Promise<AgentSkillSummary[]> {
  const registry = await getSkillRegistry()
  return registry.map(s => ({
    id: s.slug,
    name: s.name,
    description: s.description
  }))
}

const SKILL_BODY_CHARS = 6000

/** Full SKILL.md body for one skill id. Throws on unknown id. */
export async function loadAgentSkill(id: string): Promise<string> {
  const registry = await getSkillRegistry()
  const meta = registry.find(s => s.slug === id)
  if (!meta) throw new Error(`Unknown skill: ${id}`)
  const [loaded] = await loadSelectedSkillContent(
    [{ slug: meta.slug, name: meta.name, score: 1, references: [] }],
    registry
  )
  const body = loaded?.body ?? ''
  if (!body.trim()) throw new Error(`Empty skill body: ${id}`)
  return body.slice(0, SKILL_BODY_CHARS)
}

export function createSkillTool() {
  return tool({
    description:
      'Load the full instructions of a skill by id (discover ids first). Use when a task matches a skill specialty (documents, spreadsheets, web artifacts, testing…). Returns the SKILL.md playbook to follow.',
    inputSchema: z.object({
      skill: z.string().describe('Skill id, e.g. "pdf", "frontend-design"')
    }),
    execute: async ({ skill }: { skill: string }) => {
      const body = await loadAgentSkill(skill)
      return { success: true, skill, body }
    }
  })
}
