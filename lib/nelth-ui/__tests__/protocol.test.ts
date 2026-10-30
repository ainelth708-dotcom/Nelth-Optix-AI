import { describe, expect, it } from 'vitest'
import { validateNelthUISpec, validateComponentNode, NUP_LIMITS } from '../schema'
import { sanitizeUrl, sanitizePlainText } from '../sanitizer'

describe('Nelth UI Protocol (NUP) Validator', () => {
  it('validates a correct NUP specification', () => {
    const raw = {
      version: '1.0',
      root: {
        id: 'root-stack',
        component: 'stack',
        props: { direction: 'vertical', spacing: 'md' },
        children: [
          {
            id: 'header',
            component: 'heading',
            props: { level: 2, text: 'Model Comparison' }
          },
          {
            id: 'tbl',
            component: 'table',
            props: {
              columns: [
                { key: 'name', label: 'Model', sortable: true },
                { key: 'score', label: 'Benchmark', sortable: true, format: 'number' }
              ],
              rows: [
                { name: 'Model A', score: 92.4 },
                { name: 'Model B', score: 88.1 }
              ],
              searchable: true
            }
          }
        ]
      },
      metadata: {
        title: 'Comparison Results',
        theme: 'default'
      }
    }

    const res = validateNelthUISpec(raw)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.spec.version).toBe('1.0')
      expect(res.spec.root.component).toBe('stack')
      expect(res.spec.root.children).toHaveLength(2)
      expect(res.spec.root.children?.[0].component).toBe('heading')
    }
  })

  it('rejects unsupported protocol version', () => {
    const raw = {
      version: '2.0',
      root: {
        id: '1',
        component: 'text',
        props: { text: 'Hello' }
      }
    }
    const res = validateNelthUISpec(raw)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Unsupported protocol version')
    }
  })

  it('rejects unapproved or arbitrary component names', () => {
    const raw = {
      version: '1.0',
      root: {
        id: '1',
        component: 'evil_iframe_injector',
        props: { src: 'https://evil.com' }
      }
    }
    const res = validateNelthUISpec(raw)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Invalid or unapproved component type')
    }
  })

  it('rejects excessive tree depth beyond limit', () => {
    // Build a deeply nested tree exceeding MAX_TREE_DEPTH (8)
    let deepest: any = { id: 'leaf', component: 'text', props: { text: 'Deep' } }
    for (let i = 0; i < NUP_LIMITS.MAX_TREE_DEPTH + 2; i++) {
      deepest = {
        id: `node-${i}`,
        component: 'stack',
        props: {},
        children: [deepest]
      }
    }

    const res = validateNelthUISpec({
      version: '1.0',
      root: deepest
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Maximum tree depth exceeded')
    }
  })

  it('rejects excessive component count beyond limit', () => {
    const children: any[] = []
    for (let i = 0; i < NUP_LIMITS.MAX_COMPONENT_COUNT + 5; i++) {
      children.push({
        id: `c-${i}`,
        component: 'badge',
        props: { text: `Badge ${i}` }
      })
    }

    const res = validateNelthUISpec({
      version: '1.0',
      root: {
        id: 'root-grid',
        component: 'grid',
        props: { columns: 4 },
        children
      }
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Maximum component count exceeded')
    }
  })

  it('sanitizes dangerous URLs and scripts in props', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('')
    expect(sanitizeUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
    expect(sanitizeUrl('/relative/path')).toBe('/relative/path')

    const clean = sanitizePlainText('Hello <script>malicious()</script> world')
    expect(clean).toBe('Hello  world')
  })

  it('validates interactive chart props and bounds data points', () => {
    const raw = {
      version: '1.0',
      root: {
        id: 'chart-1',
        component: 'bar_chart',
        props: {
          title: 'Q3 Revenue',
          xKey: 'quarter',
          yKeys: ['revenue', 'profit'],
          data: [
            { quarter: 'Q1', revenue: 100, profit: 30 },
            { quarter: 'Q2', revenue: 140, profit: 45 }
          ],
          unit: 'k€'
        }
      }
    }

    const res = validateNelthUISpec(raw)
    expect(res.success).toBe(true)
  })
})

