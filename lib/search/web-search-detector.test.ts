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

describe('detectWebSearchIntent — standalone named entities', () => {
  it('searches for bare person, company, model and project names', () => {
    for (const message of [
      'Elon Musk',
      'Tesla',
      'OpenAI',
      'GPT-6',
      'OpenIntelligentUI',
      'Claude 3.5 Sonnet',
      'Tesla Model 3',
      'Sam Altman',
      'Et Elon Musk ?',
      'What about Tesla?',
      'OpenIntelligentUI ?'
    ]) {
      const result = detectWebSearchIntent(message)
      expect(result.needsWebSearch, message).toBe(true)
      expect(result.matchedRules, message).toContain('named-entity-information')
    }
  })

  it('searches for bare framework names but not for stable tech words', () => {
    expect(detectWebSearchIntent('Next.js').needsWebSearch).toBe(true)
    expect(detectWebSearchIntent('TypeScript').needsWebSearch).toBe(false)
    expect(detectWebSearchIntent('photosynthèse').needsWebSearch).toBe(false)
    expect(detectWebSearchIntent('Antananarivo').needsWebSearch).toBe(false)
  })

  it('answers definition questions about stable technologies directly', () => {
    const typeScript = detectWebSearchIntent('What is TypeScript?')
    expect(typeScript.needsWebSearch).toBe(false)
    expect(typeScript.matchedRules).toContain('stable-knowledge')

    expect(detectWebSearchIntent('What is Next.js?').needsWebSearch).toBe(false)
    expect(
      detectWebSearchIntent('Explique comment fonctionne Next.js')
        .needsWebSearch
    ).toBe(false)
    expect(detectWebSearchIntent('Explique Next.js').needsWebSearch).toBe(false)
  })

  it('searches for information queries about persons and companies', () => {
    for (const message of [
      'Who is Elon Musk?',
      'Tell me about OpenAI',
      'Parle-moi de Tesla',
      "Lazao amiko ny momba an'i SpaceX",
      'Qui est le PDG de Tesla ?',
      'Que fait Anthropic ?',
      "C'est quoi OpenAI ?",
      'Elon Musk dia iza ?',
      'Iza moa i Elon Musk ?',
      'Who is Steve Jobs?',
      'Qui a fondé Tesla ?',
      "OpenIntelligentUI c'est quoi ?"
    ]) {
      const result = detectWebSearchIntent(message)
      expect(result.needsWebSearch, message).toBe(true)
      expect(result.matchedRules, message).toContain('named-entity-information')
    }
  })

  it('does not treat plain statements about an entity as info queries', () => {
    expect(
      detectWebSearchIntent('OpenAI est une entreprise').needsWebSearch
    ).toBe(false)
  })

  it('searches for entity attribute queries', () => {
    expect(
      detectWebSearchIntent("Quelle est la fortune d'Elon Musk ?")
        .needsWebSearch
    ).toBe(true)
    expect(detectWebSearchIntent('Sa biographie ?').needsWebSearch).toBe(true)
    expect(detectWebSearchIntent('Tesla en bourse').needsWebSearch).toBe(true)
    expect(
      detectWebSearchIntent("Quel est le chiffre d'affaires d'OpenAI ?")
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent("Où se trouve le siège d'OpenAI ?").needsWebSearch
    ).toBe(true)
  })

  it('keeps explicit commands working around the compound-noun guard', () => {
    expect(
      detectWebSearchIntent('Fais-moi des recherches sur le web').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Explique la recherche Web').needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Fais-moi un poème sur Tesla').needsWebSearch
    ).toBe(false)
  })

  it('searches for entity versus comparisons', () => {
    for (const message of [
      'Tesla vs BYD',
      'GPT-6 vs Claude 5',
      'React vs Vue',
      'Compare Tesla et BYD'
    ]) {
      const result = detectWebSearchIntent(message)
      expect(result.needsWebSearch, message).toBe(true)
      expect(result.matchedRules, message).toContain('entity-comparison')
    }

    expect(detectWebSearchIntent('Tesla vs BYD en 2020').needsWebSearch).toBe(
      false
    )
    expect(detectWebSearchIntent('analyse vs synthèse').needsWebSearch).toBe(
      false
    )
  })
})

describe('detectWebSearchIntent — current facts and local info', () => {
  it('searches for stock prices and market questions', () => {
    expect(
      detectWebSearchIntent("What is Tesla's current stock price?")
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent("Quel est le cours de l'action Tesla ?")
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Combien coûte une Tesla Model 3 ?').needsWebSearch
    ).toBe(true)
    expect(detectWebSearchIntent('Ohatrinona ny sarany ?').needsWebSearch).toBe(
      true
    )
  })

  it('searches for current news about entities', () => {
    expect(
      detectWebSearchIntent('Find current Tesla news').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Quelles sont les actualités sur OpenAI ?')
        .needsWebSearch
    ).toBe(true)
  })

  it('searches for time, opening hours and rain questions', () => {
    expect(
      detectWebSearchIntent('Quelle heure est-il à Madagascar ?').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Où sont les restaurants ouverts maintenant ?')
        .needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent("Est-ce qu'il va pleuvoir demain à Antananarivo ?")
        .needsWebSearch
    ).toBe(true)
  })

  it('searches for sports results and standings', () => {
    expect(
      detectWebSearchIntent('Résultats du match hier soir ?').needsWebSearch
    ).toBe(true)
    expect(
      detectWebSearchIntent('Classement de la Ligue 1').needsWebSearch
    ).toBe(true)
  })

  it('ignores conceptual explanations of news and weather', () => {
    const weather = detectWebSearchIntent(
      'Explique la différence entre climat et météo'
    )
    expect(weather.needsWebSearch).toBe(false)

    const news = detectWebSearchIntent(
      'Pourquoi les actualités changent-elles ?'
    )
    expect(news.needsWebSearch).toBe(false)
    expect(news.matchedRules).not.toContain('news-recent-events')
  })
})

describe('detectWebSearchIntent — creative, supplied text and past-tense', () => {
  it('keeps fictional writing requests local', () => {
    expect(
      detectWebSearchIntent('Write a fictional story about Tesla')
        .needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Écris une chanson fictive sur Tesla')
        .needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent('Écris une actualité fictive sur le climat')
        .needsWebSearch
    ).toBe(false)
  })

  it('keeps prompt-writing requests local despite web vocabulary', () => {
    const result = detectWebSearchIntent(
      'Écris un prompt pour un agent de recherche Web'
    )
    expect(result.needsWebSearch).toBe(false)
    expect(result.matchedRules).toContain('creative-request')
  })

  it('keeps supplied-text transformations local', () => {
    const summary = detectWebSearchIntent(
      'Résume en trois points le texte que je viens de te donner'
    )
    expect(summary.needsWebSearch).toBe(false)
    expect(summary.matchedRules).toContain('supplied-text-transformation')

    const based = detectWebSearchIntent(
      'Based on this data, what is the trend?'
    )
    expect(based.needsWebSearch).toBe(false)
    expect(based.matchedRules).toContain('supplied-text-transformation')
  })

  it('does not treat past-tense search narratives as search requests', () => {
    expect(
      detectWebSearchIntent('I searched for Tesla yesterday').needsWebSearch
    ).toBe(false)
    expect(
      detectWebSearchIntent("J'ai cherché des infos sur Tesla hier")
        .needsWebSearch
    ).toBe(false)
  })

  it('respects the extended no-search instructions', () => {
    for (const message of [
      'Je ne veux pas rechercher Tesla',
      'Réponds uniquement avec tes connaissances : quelle est la capitale du Canada ?',
      "Don't browse the web for this",
      'Use only the text I gave you'
    ]) {
      const result = detectWebSearchIntent(message)
      expect(result.needsWebSearch, message).toBe(false)
      expect(result.matchedRules[0], message).toBe('explicit-no-search')
    }
  })
})

describe('detectWebSearchIntent — evaluation dataset (accuracy report)', () => {
  const dataset: Array<{ text: string; expected: boolean }> = [
    // Entities / info queries → SEARCH
    { text: 'Elon Musk', expected: true },
    { text: 'Tesla', expected: true },
    { text: 'OpenAI', expected: true },
    { text: 'GPT-6', expected: true },
    { text: 'OpenIntelligentUI', expected: true },
    { text: 'Next.js', expected: true },
    { text: 'Who is Elon Musk?', expected: true },
    { text: 'Tell me about OpenAI', expected: true },
    { text: "C'est quoi OpenAI ?", expected: true },
    { text: 'Parle-moi de Tesla', expected: true },
    { text: "Quelle est la fortune d'Elon Musk ?", expected: true },
    { text: 'Tesla vs BYD', expected: true },
    { text: 'GPT-6 vs Claude 5', expected: true },
    { text: 'Compare Tesla et BYD', expected: true },
    { text: "What is Tesla's current stock price?", expected: true },
    { text: 'Find current Tesla news', expected: true },
    // Current facts → SEARCH
    {
      text: 'Quelles sont les dernières infos sur Aashiqui 3 ?',
      expected: true
    },
    { text: 'What is the latest version of Next.js?', expected: true },
    { text: 'Quelle heure est-il ?', expected: true },
    { text: 'il fait quel temps demain ? la météo ?', expected: true },
    { text: 'Combien coûte une Tesla Model 3 ?', expected: true },
    { text: "Quel est le cours de l'action Tesla ?", expected: true },
    { text: 'Où sont les restaurants ouverts maintenant ?', expected: true },
    { text: "Est-ce qu'il va pleuvoir demain ?", expected: true },
    {
      text: 'Cherche sur le web les meilleures librairies de charts',
      expected: true
    },
    { text: 'Trouve un repo GitHub pour générer des factures', expected: true },
    { text: 'Vérifie si ce projet est encore maintenu', expected: true },
    { text: 'Résultats du match hier soir', expected: true },
    // Local / stable tasks → DIRECT
    { text: 'Bonjour', expected: false },
    { text: 'Merci beaucoup !', expected: false },
    { text: 'Explique-moi la photosynthèse', expected: false },
    { text: 'What is TypeScript?', expected: false },
    { text: 'Explique comment fonctionne Next.js', expected: false },
    { text: 'Explain electric cars', expected: false },
    { text: 'Écris-moi un poème sur la mer', expected: false },
    { text: '12 × 8', expected: false },
    { text: 'Traduis ce texte en malgache', expected: false },
    { text: 'Résume cet article', expected: false },
    { text: 'Corrige ce code TypeScript', expected: false },
    { text: 'I searched for Tesla yesterday', expected: false },
    { text: 'Do not search for Tesla', expected: false },
    { text: 'Je ne veux pas rechercher Tesla', expected: false },
    { text: 'Write a fictional story about Tesla', expected: false },
    { text: 'Écris une chanson fictive sur Tesla', expected: false },
    {
      text: 'Écris un prompt pour un agent de recherche Web',
      expected: false
    },
    // Guards → DIRECT
    {
      text: 'Explique la différence entre climat et météo',
      expected: false
    },
    { text: 'Pourquoi les actualités changent-elles ?', expected: false },
    { text: 'Tesla vs BYD en 2020', expected: false },
    { text: 'analyse vs synthèse', expected: false },
    { text: 'Compare deux algorithmes de tri', expected: false },
    { text: 'Continue', expected: false }
  ]

  it('reaches the accuracy target on the labelled dataset', () => {
    let truePositives = 0
    let trueNegatives = 0
    let falsePositives = 0
    let falseNegatives = 0
    const failures: string[] = []

    for (const { text, expected } of dataset) {
      const actual = detectWebSearchIntent(text).needsWebSearch
      if (actual && expected) truePositives += 1
      else if (!actual && !expected) trueNegatives += 1
      else if (actual && !expected) {
        falsePositives += 1
        failures.push(`FP: ${text}`)
      } else {
        falseNegatives += 1
        failures.push(`FN: ${text}`)
      }
    }

    const total = dataset.length
    const accuracy = (truePositives + trueNegatives) / total
    const precision =
      truePositives + falsePositives === 0
        ? 1
        : truePositives / (truePositives + falsePositives)
    const recall =
      truePositives + falseNegatives === 0
        ? 1
        : truePositives / (truePositives + falseNegatives)

    console.info(
      `[web-search-detector] accuracy=${accuracy.toFixed(3)} ` +
        `precision=${precision.toFixed(3)} recall=${recall.toFixed(3)} ` +
        `(${truePositives} TP, ${trueNegatives} TN, ` +
        `${falsePositives} FP, ${falseNegatives} FN)`
    )

    expect(failures).toEqual([])
    expect(accuracy).toBeGreaterThanOrEqual(0.9)
  })
})
