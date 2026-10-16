/**
 * Some models (e.g. weak defaults) emit bare OpenUI Lang — `root = Card([...])`
 * followed by component assignment lines — without the ```openui fence the
 * renderer requires. In that case the program is rendered as raw text instead
 * of the interactive OpenUI UI. This helper detects a bare OpenUI program (it
 * always starts at the `root` entry point) and wraps it in a fence so the
 * renderer picks it up.
 *
 * Like wrapBareSpecBlocks, content inside code fences is NEVER touched, a run
 * is only started by a `root = Component(...)` line, and surrounding prose
 * keeps its order. Multiline calls and object literals are followed through
 * bracket balance, so a whole tree is wrapped as one run; blank lines inside
 * the tree are kept only when another assignment line follows.
 */
const OPENUI_ROOT_RE = /^\s*root\s*=\s*[A-Z][A-Za-z0-9_]*\s*\(/
const OPENUI_ASSIGN_RE =
  /^\s*[A-Za-z_][A-Za-z0-9_-]*\s*=\s*(?:[A-Z][A-Za-z0-9_]*\s*\(|\{)/

/**
 * Net bracket depth added by one line. String literals may contain brackets,
 * so their content is ignored before counting.
 */
function bracketDelta(line: string): number {
  const sanitized = line.replace(/"(?:[^"\\]|\\.)*"/g, '""')
  let depth = 0
  for (const ch of sanitized) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
  }
  return depth
}

function nextNonBlank(lines: string[], start: number): string | null {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() !== '') return lines[i]
  }
  return null
}

export function wrapBareOpenUIBlocks(text: string): string {
  if (!text.includes('root')) return text

  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false
  let inRun = false
  let balance = 0
  let buffer: string[] = []

  const flushRun = () => {
    if (buffer.length === 0) return
    out.push('```openui')
    out.push(...buffer)
    out.push('```')
    buffer = []
    inRun = false
    balance = 0
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*```/.test(line)) {
      // A fence boundary ends any pending run; fenced content passes through.
      flushRun()
      inFence = !inFence
      out.push(line)
      continue
    }

    if (inFence) {
      out.push(line)
      continue
    }

    if (inRun) {
      // Inside an open bracket the line is structurally part of the tree.
      if (balance > 0) {
        buffer.push(line)
        balance += bracketDelta(line)
        continue
      }
      if (OPENUI_ASSIGN_RE.test(line)) {
        buffer.push(line)
        balance = bracketDelta(line)
        continue
      }
      if (line.trim() === '') {
        const next = nextNonBlank(lines, i + 1)
        if (next !== null && OPENUI_ASSIGN_RE.test(next)) {
          buffer.push(line)
          continue
        }
      }
      // The run is over: prose (and trailing blanks) stays outside the fence.
      flushRun()
      out.push(line)
      continue
    }

    if (OPENUI_ROOT_RE.test(line)) {
      inRun = true
      buffer.push(line)
      balance = bracketDelta(line)
      continue
    }

    out.push(line)
  }

  // A run left open at the end of the message still gets wrapped.
  flushRun()

  return out.join('\n')
}
