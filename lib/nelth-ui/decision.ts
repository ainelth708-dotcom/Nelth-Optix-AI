/**
 * Nelth Intelligent UI — Decision Engine
 * Hybrid 3-Layer Decision Architecture:
 *   Layer A: Deterministic TypeScript signals (instant, 0ms, zero-cost)
 *   Layer B: Structural heuristic & intent scoring
 *   Layer C: Decision policy arbitration (TEXT, DATA_VISUALIZATION, INTERACTIVE_FORM, etc.)
 */

import type { NUPComponentType } from './types'
import { foldText } from '../skills/text-fold'

export type NelthUIRoute =
  | 'TEXT'
  | 'TEXT_WITH_COMPONENTS'
  | 'GENERATED_UI'
  | 'DATA_VISUALIZATION'
  | 'INTERACTIVE_FORM'
  | 'STRUCTURED_RESULTS'

export interface DecisionResult {
  route: NelthUIRoute
  shouldGenerateUI: boolean
  confidence: number
  reason: string
  recommendedComponents: NUPComponentType[]
}

// -------------------------------------------------------------
// Intent Patterns (Layer A) - matched against foldText (lowercase, no diacritics)
// -------------------------------------------------------------

// Explicit request for comparison
const COMPARISON_RE = /\b(comparer?|comparaison|compare|versus|vs\.?|differences?|tableau\s+comparatif|matrix)\b/i

// Explicit request for charts / visual data
const CHART_RE = /\b(graphique|chart|graphe|bar\s*chart|line\s*chart|pie\s*chart|camembert|histogramme|courbe|visualise|visualiser|statistiques?|kpi|metriques?)\b/i

// Explicit request for tables / data grids
const TABLE_RE = /\b(tableau|table|grille|recapitulatif|spreadsheet|colonnes|lignes)\b/i

// Explicit request for form / calculators / interactive configurator
const FORM_RE = /\b(formulaire|form|calculateur|calculatrice|configurateur|simulation|simulateur|inputs?|saisie|quizz?|sondage)\b/i

// Explicit request for planning / roadmap / timeline / itinerary
const PLANNING_RE = /\b(planning|planifie[rz]?|itineraires?|roadmap|feuille\s+de\s+route|timeline|chronologie|programme|etapes|voyage\s+a|weekend\s+a)\b/i

// Plain chit-chat / greetings / thanks
const CHITCHAT_RE = /^\s*(bonjour|salut|coucou|hello|hi|hey|yo|ca\s+va|comment\s+ca\s+va|merci|thanks|ok|d['’]?accord|super|parfait|au\s+revoir|bye)\b/i

// Simple definition / translation / code requests where plain text/markdown is better
const PLAIN_TEXT_RE = /^\s*(qui\s+es[-\s]tu|c['’]est\s+quoi|qu['’]est[-\s]ce\s+que|definition|tradui[ts]|translate|corrige|explique\s+(?:brievement|simplement)|code[-\s]moi|ecris\s+un\s+(?:poeme|mail|message))\b/i

/**
 * Evaluates whether a user prompt warrants a Generative UI and which route to select.
 */
export function evaluateUIDecision(params: {
  query: string
  hasStructuredData?: boolean
  hasAttachments?: boolean
}): DecisionResult {
  const { query, hasStructuredData = false, hasAttachments = false } = params
  const trimmed = (query ?? '').trim()
  const folded = foldText(trimmed)

  if (!trimmed) {
    return {
      route: 'TEXT',
      shouldGenerateUI: false,
      confidence: 1.0,
      reason: 'Empty query',
      recommendedComponents: []
    }
  }

  // 1. Layer A: Pure greetings & casual chit-chat -> strictly TEXT
  if (CHITCHAT_RE.test(folded) && trimmed.length < 50) {
    return {
      route: 'TEXT',
      shouldGenerateUI: false,
      confidence: 0.98,
      reason: 'Conversational chit-chat or greeting — natural text is optimal',
      recommendedComponents: []
    }
  }

  // 2. Simple definitions or plain translation -> TEXT
  if (PLAIN_TEXT_RE.test(folded) && !CHART_RE.test(folded) && !COMPARISON_RE.test(folded)) {
    return {
      route: 'TEXT',
      shouldGenerateUI: false,
      confidence: 0.9,
      reason: 'Explanatory, translation or coding request — standard text/code block is optimal',
      recommendedComponents: []
    }
  }

  // 3. Explicit Comparison -> STRUCTURED_RESULTS (Table or ComparisonMatrix)
  if (COMPARISON_RE.test(folded)) {
    return {
      route: 'STRUCTURED_RESULTS',
      shouldGenerateUI: true,
      confidence: 0.95,
      reason: 'Explicit comparison request — comparison matrix and table provide superior utility',
      recommendedComponents: ['comparison', 'table', 'card', 'badge']
    }
  }

  // 4. Explicit Chart or Data Visualization -> DATA_VISUALIZATION
  if (CHART_RE.test(folded) || (hasStructuredData && TABLE_RE.test(folded))) {
    return {
      route: 'DATA_VISUALIZATION',
      shouldGenerateUI: true,
      confidence: 0.92,
      reason: 'Data visualization or statistical analysis request — interactive charts and KPI cards',
      recommendedComponents: ['kpi_grid', 'bar_chart', 'line_chart', 'table']
    }
  }

  // 5. Interactive Form / Calculator / Simulation -> INTERACTIVE_FORM
  if (FORM_RE.test(folded)) {
    return {
      route: 'INTERACTIVE_FORM',
      shouldGenerateUI: true,
      confidence: 0.93,
      reason: 'Interactive form, calculation or simulation request — interactive inputs and submit action',
      recommendedComponents: ['form', 'input', 'select', 'slider', 'button']
    }
  }

  // 6. Planning, Timeline or Itinerary -> GENERATED_UI
  if (PLANNING_RE.test(folded)) {
    return {
      route: 'GENERATED_UI',
      shouldGenerateUI: true,
      confidence: 0.91,
      reason: 'Structured planning or itinerary request — timeline and step cards',
      recommendedComponents: ['itinerary', 'timeline', 'task_board', 'card']
    }
  }

  // 7. Structured table request
  if (TABLE_RE.test(folded)) {
    return {
      route: 'STRUCTURED_RESULTS',
      shouldGenerateUI: true,
      confidence: 0.88,
      reason: 'Explicit table request — searchable and sortable table component',
      recommendedComponents: ['table', 'card']
    }
  }

  // 8. Layer B: Heuristic evaluation for data / analytical requests
  // Check if query mentions metrics, percentages, numbers, rankings
  const hasMetricKeywords = /\b(chiffres?|ventes?|revenus?|croissance|taux|pourcentages?|scores?|top\s*\d+|classement)\b/i.test(folded)
  if (hasMetricKeywords && (hasStructuredData || hasAttachments)) {
    return {
      route: 'DATA_VISUALIZATION',
      shouldGenerateUI: true,
      confidence: 0.82,
      reason: 'Dataset metrics detected with attached data — data visualization',
      recommendedComponents: ['kpi_grid', 'table', 'bar_chart']
    }
  }

  // 9. Default: Standard text response
  return {
    route: 'TEXT',
    shouldGenerateUI: false,
    confidence: 0.75,
    reason: 'Standard conceptual or factual query — direct text response is cleanest',
    recommendedComponents: []
  }
}
