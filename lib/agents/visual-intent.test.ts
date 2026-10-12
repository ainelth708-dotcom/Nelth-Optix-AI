import { describe, expect, test } from 'vitest'

import { classifyVisualIntent } from './visual-intent'

describe('classifyVisualIntent', () => {
  test.each(['Bonjour', 'What is 2 + 2?', 'Translate this sentence'])(
    'keeps "%s" as a text response',
    prompt => {
      expect(classifyVisualIntent(prompt).intent).toBe('not_needed')
    }
  )

  test.each([
    'Show this data as a chart',
    'Create a tip calculator',
    'Compare these three models'
  ])('enables a useful native UI for "%s"', prompt => {
    expect(classifyVisualIntent(prompt).intent).not.toBe('not_needed')
  })

  test.each([
    'Organise-moi un séjour de 2 jours à Paris. Propose plusieurs lieux à visiter avec une courte description et des photos, affiche-les sur une carte avec un itinéraire, puis crée un programme jour par jour que je peux personnaliser.',
    'Plan a weekend trip with an itinerary and map.',
    'Organiza un viaje y muestra los lugares en un mapa con una ruta.'
  ])('enables the interactive travel UI for "%s"', prompt => {
    expect(classifyVisualIntent(prompt).intent).toBe('required')
  })

  test('does not force travel UI for a non-visual travel question', () => {
    expect(classifyVisualIntent('What should I pack for a trip?').intent).toBe(
      'not_needed'
    )
  })
})
