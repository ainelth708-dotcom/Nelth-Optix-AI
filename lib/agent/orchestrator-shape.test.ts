import { describe, expect, it } from 'vitest'

import { normalizeForSchema } from './orchestrator'

describe('normalizeForSchema', () => {
  it('passes canonical shapes through', () => {
    expect(
      normalizeForSchema({ title: 'T', steps: [{ title: 'A', detail: 'x' }] })
    ).toEqual({ title: 'T', steps: [{ title: 'A', detail: 'x' }] })
  })

  it('coerces alternative step key names', () => {
    expect(
      normalizeForSchema({
        title: 'T',
        steps: [
          { step: 'Chercher', description: 'le web' },
          { name: 'Comparer', desc: 'tableau' },
          'Conclure vite'
        ]
      })
    ).toEqual({
      title: 'T',
      steps: [
        { title: 'Chercher', detail: 'le web' },
        { title: 'Comparer', detail: 'tableau' },
        { title: 'Conclure vite', detail: '' }
      ]
    })
  })

  it('unwraps nested and bare-array plans', () => {
    expect(
      normalizeForSchema({ plan: { title: 'T', steps: [{ title: 'A' }] } })
    ).toEqual({
      plan: { title: 'T', steps: [{ title: 'A' }] },
      title: 'T',
      steps: [{ title: 'A', detail: '' }]
    })
    expect(normalizeForSchema([{ title: 'A' }])).toEqual({
      title: 'Plan',
      steps: [{ title: 'A', detail: '' }]
    })
  })

  it('drops empty steps and passes garbage through for zod to reject', () => {
    expect(normalizeForSchema({ title: 'T', steps: [{}, '  '] })).toEqual({
      title: 'T',
      steps: []
    })
    expect(normalizeForSchema(null)).toBe(null)
    expect(normalizeForSchema('nope')).toBe('nope')
  })
})
