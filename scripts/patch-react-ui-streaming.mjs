/**
 * react-ui 0.18.1 only renders the streaming answer while it looks like
 * OpenUI Lang (InterleavedTurn `hasLangSyntax` gate), so plain Markdown
 * answers appear all at once. Patch both dist builds so they stream.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target =
  'const answer = !turnLive || hasLangSyntax(lastContent) ? last : null;'
const replacement = 'const answer = last;'

for (const file of ['dist/index.mjs', 'dist/index.cjs']) {
  const path = join(root, 'node_modules', '@openuidev', 'react-ui', file)
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    console.warn(`[patch-react-ui] ${file}: not found, skipping`)
    continue
  }
  if (!source.includes(target)) {
    console.log(`[patch-react-ui] ${file}: already patched`)
    continue
  }
  writeFileSync(path, source.replace(target, replacement))
  console.log(`[patch-react-ui] ${file}: streamed answers enabled`)
}
