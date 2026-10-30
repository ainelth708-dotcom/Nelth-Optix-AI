import { describe, expect, it } from 'vitest'
import { evaluateUIDecision } from '../decision'

describe('Nelth Intelligent UI Decision Engine', () => {
  it('routes ordinary greetings to TEXT without generating UI', () => {
    const res = evaluateUIDecision({ query: 'Bonjour ! Comment ça va ?' })
    expect(res.shouldGenerateUI).toBe(false)
    expect(res.route).toBe('TEXT')
  })

  it('routes simple definitions and explanations to TEXT', () => {
    const res = evaluateUIDecision({ query: "Qu'est-ce que l'intelligence artificielle ?" })
    expect(res.shouldGenerateUI).toBe(false)
    expect(res.route).toBe('TEXT')
  })

  it('routes model comparison to STRUCTURED_RESULTS', () => {
    const res = evaluateUIDecision({ query: 'Compare les modèles Claude 3.7, GPT-4o et Nelth-3.5' })
    expect(res.shouldGenerateUI).toBe(true)
    expect(res.route).toBe('STRUCTURED_RESULTS')
    expect(res.recommendedComponents).toContain('comparison')
  })

  it('routes chart requests to DATA_VISUALIZATION', () => {
    const res = evaluateUIDecision({ query: 'Affiche un graphique en barres des ventes par trimestre' })
    expect(res.shouldGenerateUI).toBe(true)
    expect(res.route).toBe('DATA_VISUALIZATION')
    expect(res.recommendedComponents).toContain('bar_chart')
  })

  it('routes form and calculator requests to INTERACTIVE_FORM', () => {
    const res = evaluateUIDecision({ query: 'Crée un formulaire de simulation de prêt immobilier avec slider' })
    expect(res.shouldGenerateUI).toBe(true)
    expect(res.route).toBe('INTERACTIVE_FORM')
    expect(res.recommendedComponents).toContain('form')
  })

  it('routes travel itinerary and planning to GENERATED_UI', () => {
    const res = evaluateUIDecision({ query: 'Planifie un itinéraire pour un weekend à Paris' })
    expect(res.shouldGenerateUI).toBe(true)
    expect(res.route).toBe('GENERATED_UI')
    expect(res.recommendedComponents).toContain('itinerary')
  })

  it('routes explicit table requests to STRUCTURED_RESULTS', () => {
    const res = evaluateUIDecision({ query: 'Fais-moi un tableau récapitulatif des 10 plus hauts sommets' })
    expect(res.shouldGenerateUI).toBe(true)
    expect(res.route).toBe('STRUCTURED_RESULTS')
    expect(res.recommendedComponents).toContain('table')
  })
})

