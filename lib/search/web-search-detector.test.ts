import { describe, expect, it } from 'vitest'

import {
  detectWebSearchIntent,
  WEB_SEARCH_DETECTOR_WEIGHTS,
  WEB_SEARCH_SCORE_THRESHOLD
} from './web-search-detector'

describe('detectWebSearchIntent — greetings and small talk', () => {
  it('skips the web search for pure greetings (FR/EN/MG)', () => {
    for (const message of [
      'Bonjour',
      'Salut !',
      'Hello',
      'Coucou',
      'Manao ahoana',
      'Salama',
      'How are you?'
    ]) {
      const result = detectWebSearchIntent(message)
      expect(result.needsWebSearch, message).toBe(false)
      expect(result.score, message).toBeLessThan(0)
    }
  })

  it('skips short thanks and casual chat', () => {
    expect(
      detectWebSearchIntent('Salut, merci beaucoup !').needsWebSearch
    ).toBe(false)
    expect(detectWebSearchIntent('Misaotra, veloma !').needsWebSearch).toBe(
      false
    )
    expect(detectWebSearchIntent('Merci, bonne journée !').needsWebSearch).toBe(
      false
    )
  })
})

describe('detectWebSearchIntent — local tasks without web need', () => {
  it('skips stable-knowledge explanations', () => {
    const result = detectWebSearchIntent('Explique-moi la photosynthèse')
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules).toContain('stable-knowledge')
  })

  it('skips self-contained coding help', () => {
    const result = detectWebSearchIntent('Corrige ce code TypeScript')
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules).toContain('self-contained-code')
    expect(result.matchedRules).toContain('translation-rewriting')
    expect(result.score).toBe(-160)
  })

  it('skips code blocks pasted in the message', () => {
    const message = [
      'Peux-tu corriger ce code ?',
      '',
      '```ts',
      'const x: number = "oops"',
      '```'
    ].join('\n')
    const result = detectWebSearchIntent(message)
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules).toContain('self-contained-code')
  })

  it('skips translation and rewriting requests', () => {
    for (const message of [
      'Traduis ce paragraphe en anglais',
      'Réécris cette lettre de motivation',
      'Résume cet article en trois points',
      'Corrige les fautes de ce texte'
    ]) {
      expect(detectWebSearchIntent(message).needsWebSearch, message).toBe(false)
    }
  })

  it('skips creative requests', () => {
    expect(
      detectWebSearchIntent('Écris-moi un poème sur la mer').needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Cherche un prénom pour mon bébé').needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Trouve-moi une idée de cadeau').needsWebSearch
    ).toBe(false)
  })

  it('skips simple arithmetic', () => {
    expect(detectWebSearchIntent('12 × 8').needsWebSearch).toBe(false)
    expect(
      detectWebSearchIntent('Combien font 452 + 89 ?').needsWebSearch
    ).toBe(false)
  })
})

describe('detectWebSearchIntent — explicit search requests', () => {
  it('searches when the user explicitly asks for a web search (FR)', () => {
    const result = detectWebSearchIntent(
      'Cherche sur le web les meilleures librairies de charts'
    )
    expect(result.needsWebSearch).toBe(true)
    expect(result.matchedRules).toContain('explicit-search-request')
    expect(result.matchedRules).toContain('find-online-projects')
    expect(result.score).toBe(180)
  })

  it('searches on imperative search commands (EN)', () => {
    expect(
      detectWebSearchIntent(
        'Search GitHub for an open-source invoice generator'
      ).needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Find this repository on GitHub').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Look up the official React documentation online')
        .needsWebSearch
    ).toBe(true)
  })

  it('searches on explicit requests in Malagasy', () => {
    expect(
      detectWebSearchIntent("Tadiavo ao amin'ny GitHub ny projet open-source")
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent("Jereo amin'ny web izany").needsWebSearch
    ).toBe(true)
  })

  it('lets an explicit search request override negative signals', () => {
    const result = detectWebSearchIntent(
      'Cherche sur le web et traduis le résultat en français'
    )
    expect(result.needsWebSearch).toBe(true)
    expect(result.score).toBe(0)
  })

  it('does not treat creative commands as search requests', () => {
    const result = detectWebSearchIntent('Cherche un prénom pour mon bébé')
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules).toContain('creative-request')
  })
})

describe('detectWebSearchIntent — time-sensitive questions', () => {
  it('searches for news-style questions (ported cases)', () => {
    for (const message of [
      'Quelles sont les dernières infos sur Aashiqui 3 ?',
      'Aashiqui 3 : casting officiel, date de sortie confirmée, teaser',
      'What is the latest news about Tesla?',
      'donne-moi des infos récentes sur Elon Musk',
      'quelles sont les nouveautés ?',
      'quoi de neuf ?'
    ]) {
      expect(detectWebSearchIntent(message).needsWebSearch, message).toBe(true)
    }
  })

  it('searches for weather and prices', () => {
    expect(
      detectWebSearchIntent('il fait quel temps demain ? la météo ?')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('combien coûte le nouveau iPhone ?').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Quel est le prix du miel à Antananarivo ?')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('MÉTÉO à Toamasina demain ?').needsWebSearch
    ).toBe(true)
  })

  it('searches when asked what is happening today', () => {
    expect(
      detectWebSearchIntent("Il se passe quoi aujourd'hui ?").needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('inona ny vaovao androany ?').needsWebSearch
    ).toBe(true)
  })

  it('ignores stable-knowledge phrasing when a strong news signal matches', () => {
    const result = detectWebSearchIntent('What is the latest news about Tesla?')
    expect(result.needsWebSearch).toBe(true)
    expect(result.score).toBe(90)
    expect(result.matchedRules).not.toContain('stable-knowledge')
  })
})

describe('detectWebSearchIntent — verification, versions and docs', () => {
  it('searches for verification requests', () => {
    expect(
      detectWebSearchIntent('Check whether this project is still maintained')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Vérifie cette URL : https://example.com/repo')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Est-ce que ce repo est encore maintenu ?')
        .needsWebSearch
    ).toBe(true)
  })

  it('searches for latest versions', () => {
    const result = detectWebSearchIntent(
      'What is the latest version of Next.js?'
    )
    expect(result.needsWebSearch).toBe(true)
    expect(result.matchedRules).toContain('latest-version')
    expect(result.matchedRules).not.toContain('stable-knowledge')
    expect(
      detectWebSearchIntent("Tamin'ny version farany ve ny Next.js ?")
        .needsWebSearch
    ).toBe(true)
  })

  it('searches for current official documentation', () => {
    expect(
      detectWebSearchIntent(
        "Où trouver la documentation officielle de l'API Stripe ?"
      ).needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Montre-moi la doc officielle actuelle de React')
        .needsWebSearch
    ).toBe(true)
  })

  it('searches for currently available resources', () => {
    const result = detectWebSearchIntent(
      'Find currently available free APIs for weather data'
    )
    expect(result.needsWebSearch).toBe(true)
    expect(result.matchedRules).toContain('find-online-projects')
    expect(result.matchedRules).toContain('changing-facts')
    expect(result.score).toBe(300)
  })

  it('searches when comparing currently sold products', () => {
    expect(
      detectWebSearchIntent('Quel est le meilleur smartphone actuellement ?')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Compare deux algorithmes de tri').needsWebSearch
    ).toBe(false)
  })
})

describe('detectWebSearchIntent — explicit no-search and follow-ups', () => {
  it('respects an explicit no-search instruction (FR/EN/MG)', () => {
    const result = detectWebSearchIntent(
      'Ne cherche pas sur le web, réponds de mémoire : quelle est la capitale de Madagascar ?'
    )
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules[0]).toBe('explicit-no-search')

    expect(
      detectWebSearchIntent("Don't search the web, just answer from memory")
        .needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent(
        "Aza mitady ao amin'ny web, valio avy amin'ny fahalalanao"
      ).needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Réponds sans chercher : combien font 12 × 8 ?')
        .needsWebSearch
    ).toBe(false)
  })

  it('treats short continuations as context follow-ups', () => {
    const context = { recentTurns: ["Explique-moi le cycle de l'eau"] }
    const continuation = detectWebSearchIntent('Continue', context)
    expect(continuation.needsWebSearch).toBe(false)
    expect(continuation.matchedRules).toContain('follow-up-context')

    const elaboration = detectWebSearchIntent('Développe davantage', context)
    expect(elaboration.needsWebSearch).toBe(false)
    expect(elaboration.matchedRules).toContain('follow-up-context')

    expect(detectWebSearchIntent('Continue').matchedRules).not.toContain(
      'follow-up-context'
    )
  })

  it('lets a strong signal override the follow-up penalty', () => {
    const context = { recentTurns: ['On parlait de Paris'] }
    const result = detectWebSearchIntent('Et la météo demain ?', context)
    expect(result.needsWebSearch).toBe(true)
    expect(result.matchedRules).not.toContain('follow-up-context')
  })
})

describe('detectWebSearchIntent — mixed languages and result shape', () => {
  it('handles mixed-language messages', () => {
    expect(
      detectWebSearchIntent(
        "Salama! Tadiavo ao amin'ny web ny vaovao farany momba an'i Madagascar"
      ).needsWebSearch
    ).toBe(true)
  })

  it('returns a well-formed detection result', () => {
    const result = detectWebSearchIntent('Bonjour')
    expect(typeof result.needsWebSearch).toBe('boolean')
    expect(typeof result.score).toBe('number')
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
    expect(Array.isArray(result.matchedRules)).toBe(true)
  })

  it('handles empty and whitespace-only messages', () => {
    expect(detectWebSearchIntent('')).toEqual({
      needsWebSearch: false,
      score: 0,
      reason: 'Empty message: nothing to search for.',
      matchedRules: []
    })
    const blank = detectWebSearchIntent('   ')
    expect(blank.needsWebSearch).toBe(false)
    expect(blank.matchedRules).toEqual([])
  })

  it('exports the tunable configuration', () => {
    expect(WEB_SEARCH_SCORE_THRESHOLD).toBe(60)
    expect(WEB_SEARCH_DETECTOR_WEIGHTS.explicitSearchRequest).toBe(100)
    expect(WEB_SEARCH_DETECTOR_WEIGHTS.newsRecentEvents).toBe(90)
    expect(WEB_SEARCH_DETECTOR_WEIGHTS.greetingChitchat).toBe(-100)
    expect(WEB_SEARCH_DETECTOR_WEIGHTS.followUpContext).toBe(-50)
  })

  it('stays fast on a burst of messages', () => {
    const samples = [
      'Bonjour',
      'Cherche sur le web les meilleures librairies de charts',
      'Quelles sont les dernières infos sur Aashiqui 3 ?',
      'Explique-moi la photosynthèse',
      'What is the latest version of Next.js?',
      "Aza mitady ao amin'ny web"
    ]
    const startedAt = performance.now()
    for (let index = 0; index < 500; index++) {
      detectWebSearchIntent(samples[index % samples.length])
    }
    expect(performance.now() - startedAt).toBeLessThan(1000)
  })
})
