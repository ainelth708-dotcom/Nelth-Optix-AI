/**
 * OpenUI Lang program repair — pure TypeScript (server-safe, SSR-safe).
 *
 * Weak models (e.g. nvidia/z-ai/glm-5.2) sometimes emit truncated or
 * unbalanced opui-lang programs as text, which the strict Lang Renderer then
 * rejects at settle time (blank frame). This module repairs the most common
 * corruption classes WITHOUT touching valid programs, and feeds a salvage
 * ladder that guarantees a renderable page:
 *
 *   1. plain repair  — bracket balancing (string/template/comment aware),
 *                      dangling commas, curly-quote artifacts, fence markers
 *   2. salvage       — drop trailing corrupted statements, keep the head
 *   3. minimal page  — a synthesized always-valid apology page
 */

export type FrameKind = 'code' | 'string' | 'template' | 'templateExpr'

export type BracketIssue = {
  kind: 'open' | 'close' | 'string-open'
  char: string
  index: number
}

export type StringSpan = { from: number; to: number }

export type BracketScan = {
  issues: BracketIssue[]
  /** Non-string bracket depth at end of scan (0 = balanced). */
  depth: number
  /** Top-level statement starts (`name =` at col 0 outside strings). */
  statementStarts: Array<{ index: number; name: string }>
  /** Character ranges (inclusive) holding string/template content. */
  stringSpans: StringSpan[]
}

const CLOSERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}'
}

const OPEN_CHARS = new Set(['(', '[', '{'])

const STMT_START_RE = /^([A-Za-z_$][\w$-]*)\s*=/

/**
 * Lexes the program: tracks code vs string vs template contexts, reports
 * bracket imbalances, unterminated strings/templates and statement
 * boundaries. Backtick templates pause on `${`, lex the expression, resume —
 * like JS template literals.
 */
export function scanProgram(source: string): BracketScan {
  const issues: BracketIssue[] = []
  const stack: Array<{ char: string; index: number }> = []
  const frames: Array<{ kind: FrameKind; quote?: string; at: number }> = [
    { kind: 'code', at: -1 }
  ]
  const statementStarts: Array<{ index: number; name: string }> = []
  const stringSpans: StringSpan[] = []
  // Position 0 of the file is a statement start candidate too.
  let statementArmed = true

  const closeSpan = (frame: { kind: FrameKind; at: number }, to: number) => {
    if (frame.kind === 'string' || frame.kind === 'template') {
      stringSpans.push({ from: frame.at, to })
    }
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    const frame = frames[frames.length - 1]

    if (frame.kind === 'string' || frame.kind === 'template') {
      if (ch === '\\' && i + 1 < source.length) {
        i += 1
        continue
      }
      if (frame.kind === 'template' && ch === '$' && source[i + 1] === '{') {
        frames.push({ kind: 'templateExpr', at: i })
        i += 1
        continue
      }
      if (frame.kind === 'string' && ch === frame.quote) {
        frames.pop()
        closeSpan(frame, i)
      } else if (frame.kind === 'template' && ch === '`') {
        frames.pop()
        closeSpan(frame, i)
      }
      continue
    }

    // ----- code / templateExpr contexts -----
    if (ch === '"' || ch === "'" || ch === '`') {
      frames.push(
        ch === '`'
          ? { kind: 'template', at: i }
          : { kind: 'string', quote: ch, at: i }
      )
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2)
      if (nl === -1) break
      i = nl
      statementArmed = true
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end === -1) break
      i = end + 1
      continue
    }
    if (OPEN_CHARS.has(ch)) {
      stack.push({ char: ch, index: i })
      statementArmed = false
      continue
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (ch === '}' && frames[frames.length - 1].kind === 'templateExpr') {
        // `}` closes a `${ … }` template expression, not a brace
        frames.pop()
        continue
      }
      const top = stack[stack.length - 1]
      if (top && CLOSERS[top.char] === ch) {
        stack.pop()
        if (stack.length === 0) statementArmed = true
      } else if (ch !== '}' || !frames.some(f => f.kind === 'templateExpr')) {
        issues.push({ kind: 'close', char: ch, index: i })
      }
      continue
    }
    if (ch === '\n') statementArmed = true
    else if (statementArmed && !/\s/.test(ch) && stack.length === 0) {
      statementArmed = false
      const m = STMT_START_RE.exec(source.slice(i))
      if (m) statementStarts.push({ index: i, name: m[1] })
    }
  }

  for (const item of stack) {
    issues.push({ kind: 'open', char: item.char, index: item.index })
  }
  const top = frames[frames.length - 1]
  if (top.kind === 'string' || top.kind === 'template') {
    issues.push({ kind: 'string-open', char: top.quote ?? '`', index: top.at })
    // Treat the unterminated tail as string content.
    stringSpans.push({ from: top.at, to: source.length - 1 })
  }

  return { issues, depth: stack.length, statementStarts, stringSpans }
}

const CURLY_ANY = /[\u201C\u201D\u2018\u2019]/
const CURLY_DOUBLE = /[\u201C\u201D]/

/**
 * Normalizes curly smart quotes that live OUTSIDE strings (model artifacts
 * around identifiers/call syntax). Smart quotes INSIDE strings are legitimate
 * French typography (apostrophes!) and must be preserved — otherwise
 * `'l’article'` would become the broken `'l'article'`.
 */
function normalizeCodeQuotes(source: string): string {
  if (!CURLY_ANY.test(source)) return source
  const { stringSpans } = scanProgram(source)
  const isCode = (i: number) =>
    !stringSpans.some(span => i >= span.from && i <= span.to)
  let rebuilt = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (!isCode(i) || !CURLY_ANY.test(ch)) {
      rebuilt += ch
      continue
    }
    rebuilt += CURLY_DOUBLE.test(ch) ? '"' : "'"
  }
  return rebuilt
}

function stripFences(source: string): string {
  return (
    source
      .trim()
      // opening fence (with optional openui/openui-lang suffix)
      .replace(/^```(?:openui)?(?:-lang)?[\t ]*\r?\n?/i, '')
      // closing fence (complete or mid-stream partial trailing backticks)
      .replace(/\r?\n```[\s]*$/, '')
      .replace(/\r?\n``[\s]*$/, '')
      .replace(/\r?\n`[\s]*$/, '')
  )
}

/**
 * Repairs the most common LLM corruptions. Repairs valid programs to
 * themselves (single pass, cheap). Code-context edits only: string content is
 * never modified beyond closers that terminate truncation.
 */
export function repairOpenUIProgram(source: string): string {
  let out = stripFences(source)
  // Curly-quote artifacts first (index-stable, code-context only), so the
  // drop pass below sees the final character layout.
  out = normalizeCodeQuotes(out)

  // 1) drop extra closers + dangling commas, normalize curly quotes — ONE
  // scanner pass collects every code-context edit, then one rebuild applies
  // it (index-stable).
  let scan = scanProgram(out)
  const drops = new Set<number>()
  for (const issue of scan.issues) {
    if (issue.kind === 'close' && issue.index >= 0) drops.add(issue.index)
  }
  const isCode = (i: number) =>
    !scan.stringSpans.some(span => i >= span.from && i <= span.to)
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== ',' || !isCode(i)) continue
    let j = i + 1
    while (j < out.length && /\s/.test(out[j])) j += 1
    if (
      j < out.length &&
      (out[j] === ')' || out[j] === ']' || out[j] === '}') &&
      isCode(j)
    ) {
      // Drop the comma AND the whitespace that separates it from the closer.
      for (let k = i; k < j; k++) drops.add(k)
    }
  }
  if (drops.size > 0) {
    let rebuilt = ''
    for (let i = 0; i < out.length; i++) {
      if (!drops.has(i)) rebuilt += out[i]
    }
    out = rebuilt
  }

  // 2) close an unterminated string/template: at end of line when the string
  // runs on (truncation artifact), else at end of file.
  scan = scanProgram(out)
  const unterminated = scan.issues.find(i => i.kind === 'string-open')
  if (unterminated) {
    const nl = out.indexOf('\n', unterminated.index + 1)
    const at = nl === -1 ? out.length : nl
    out = `${out.slice(0, at)}${unterminated.char}${out.slice(at)}`
  }

  // 3) append the missing closers, outermost last
  scan = scanProgram(out)
  const opens = scan.issues.filter(i => i.kind === 'open')
  if (opens.length > 0) {
    out = `${out.replace(/[\s\r\n]+$/, '')}${[...opens]
      .reverse()
      .map(o => CLOSERS[o.char])
      .join('')}`
  }

  return out.trim()
}

/**
 * Splits the program into top-level statements (statement starts found by the
 * lexer: `name = ...` at column 0 while depth is 0). Truncating the array keeps
 * the head statements intact.
 */
export function splitStatementsForSalvage(source: string): string[] {
  const scan = scanProgram(source)
  const starts = scan.statementStarts.map(s => s.index).sort((a, b) => a - b)
  const chunks: string[] = []
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]
    const to = i + 1 < starts.length ? starts[i + 1] : source.length
    chunks.push(source.slice(from, to).trimEnd())
  }
  return chunks
}

/**
 * ALWAYS-renderable last-resort page (pure opui-lang the parser accepts).
 */
export function minimalFallbackPage(): string {
  return `root = Col([
  Text("La page n'a pas pu être générée complètement."),
  Caption("Reformulez ou réessayez la demande.")
])`
}
