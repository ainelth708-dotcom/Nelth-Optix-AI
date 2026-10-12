import {
  compileSpecStream,
  createSpecStreamCompiler,
  formatSpecIssues,
  type Spec,
  validateSpec
} from '@json-render/core'

import { catalog } from './catalog'
import { migrateSpec } from './migrations'

function compileSource(source: string): Spec {
  return compileSpecStream(source, {
    root: '',
    elements: {}
  }) as Spec
}

// Ensure every element has the fields @json-render expects at render time
// (props/bindings as objects, children as an array). Some models emit partial
// specs where `props` is omitted, which makes `resolveBindings` crash with
// "Cannot convert undefined or null to object".
function normalizeElement(element: Record<string, any>): Record<string, any> {
  return {
    ...element,
    props:
      element.props && typeof element.props === 'object' ? element.props : {},
    bindings:
      element.bindings && typeof element.bindings === 'object'
        ? element.bindings
        : {},
    children: Array.isArray(element.children) ? element.children : []
  }
}

function prunePartialSpec(spec: Spec): Spec {
  const elementKeys = new Set(Object.keys(spec.elements ?? {}))
  const elements = Object.fromEntries(
    Object.entries(spec.elements ?? {}).map(([key, element]) => [
      key,
      {
        ...normalizeElement(element),
        children: (element.children ?? []).filter((childKey: string) =>
          elementKeys.has(childKey)
        )
      }
    ])
  )

  return {
    ...spec,
    elements: elements as Spec['elements']
  }
}

type PartialSpecCompiler = ReturnType<typeof createSpecStreamCompiler>

function createCompiler(): PartialSpecCompiler {
  return createSpecStreamCompiler({
    root: '',
    elements: {}
  })
}

export type PartialSpecParser = {
  parse(source: string): Spec | null
  reset(): void
}

export function createPartialSpecParser(): PartialSpecParser {
  let compiler = createCompiler()
  let lastSource = ''

  return {
    parse(source: string): Spec | null {
      if (!source.trim()) {
        compiler = createCompiler()
        lastSource = ''
        return null
      }

      if (source === lastSource) {
        const result = migrateSpec(
          prunePartialSpec(compiler.getResult() as Spec)
        )
        return result.root ? result : null
      }

      if (source.startsWith(lastSource)) {
        compiler.push(source.slice(lastSource.length))
        lastSource = source
        const result = migrateSpec(
          prunePartialSpec(compiler.getResult() as Spec)
        )
        return result.root ? result : null
      }

      compiler = createCompiler()
      compiler.push(source)
      lastSource = source
      const result = migrateSpec(prunePartialSpec(compiler.getResult() as Spec))
      return result.root ? result : null
    },
    reset() {
      compiler = createCompiler()
      lastSource = ''
    }
  }
}

export function parseSpecBlock(source: string): Spec {
  // Apply legacy type migrations before catalog validation so that old
  // specs persisted in chat history can still validate against the current
  // catalog.
  const compiled = migrateSpec(compileSource(source))
  const validation = catalog.validate(compiled)

  if (!validation.success || !validation.data) {
    const issues = validation.error?.issues
      .map((issue: { message: string }) => issue.message)
      .join(', ')
    throw new Error(issues || 'Invalid spec block')
  }

  const validatedSpec = validation.data as Spec
  const specIssues = validateSpec(validatedSpec)
  if (!specIssues.valid) {
    throw new Error(formatSpecIssues(specIssues.issues))
  }

  // Normalize elements so the renderer never receives an element without
  // `props`/`bindings` (would crash @json-render's resolveBindings).
  return {
    ...validatedSpec,
    elements: Object.fromEntries(
      Object.entries(validatedSpec.elements ?? {}).map(([key, element]) => [
        key,
        normalizeElement(element as Record<string, any>)
      ])
    ) as Spec['elements']
  }
}
