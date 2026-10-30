/**
 * Structured Pipeline Timing and Performance Instrumentation for Nelth-IA
 * Conforms to Section 11 of the Performance Optimization Specification.
 */

export type PipelineRoute =
  | 'direct'
  | 'search'
  | 'connector'
  | 'image'
  | 'document'
  | 'agent'

export interface PipelineStageTimings {
  requestId: string
  route: PipelineRoute
  startTime: number
  setupMs?: number
  intentDetectionMs?: number
  promptConstructionMs?: number
  toolConstructionMs?: number
  connectorPrepMs?: number
  agentConstructionMs?: number
  modelRequestStartMs?: number
  serverTtftMs?: number
  totalResponseMs?: number
  modelCallCount: number
  toolCallCount: number
  promptCharCount?: number
  promptTokenEstimate?: number
  status: 'streaming' | 'completed' | 'failed' | 'aborted'
  errorMessage?: string
}

export class PipelineTracker {
  private timings: PipelineStageTimings
  private lastCheckpoint: number

  constructor(requestId?: string, route: PipelineRoute = 'direct') {
    const now = performance.now()
    this.timings = {
      requestId: requestId || `req-${Math.random().toString(36).slice(2, 9)}`,
      route,
      startTime: now,
      modelCallCount: 0,
      toolCallCount: 0,
      status: 'streaming'
    }
    this.lastCheckpoint = now
  }

  setRoute(route: PipelineRoute) {
    this.timings.route = route
  }

  recordSetup() {
    const now = performance.now()
    this.timings.setupMs = Number((now - this.lastCheckpoint).toFixed(2))
    this.lastCheckpoint = now
  }

  recordIntentDetection(durationMs?: number) {
    const now = performance.now()
    this.timings.intentDetectionMs =
      durationMs !== undefined
        ? Number(durationMs.toFixed(2))
        : Number((now - this.lastCheckpoint).toFixed(2))
    this.lastCheckpoint = now
  }

  recordPromptConstruction(charCount?: number) {
    const now = performance.now()
    this.timings.promptConstructionMs = Number(
      (now - this.lastCheckpoint).toFixed(2)
    )
    if (charCount !== undefined) {
      this.timings.promptCharCount = charCount
      this.timings.promptTokenEstimate = Math.ceil(charCount / 4)
    }
    this.lastCheckpoint = now
  }

  recordToolConstruction() {
    const now = performance.now()
    this.timings.toolConstructionMs = Number(
      (now - this.lastCheckpoint).toFixed(2)
    )
    this.lastCheckpoint = now
  }

  recordConnectorPrep() {
    const now = performance.now()
    this.timings.connectorPrepMs = Number(
      (now - this.lastCheckpoint).toFixed(2)
    )
    this.lastCheckpoint = now
  }

  recordAgentConstruction() {
    const now = performance.now()
    this.timings.agentConstructionMs = Number(
      (now - this.lastCheckpoint).toFixed(2)
    )
    this.lastCheckpoint = now
  }

  recordModelRequestStart() {
    const now = performance.now()
    this.timings.modelRequestStartMs = Number(
      (now - this.timings.startTime).toFixed(2)
    )
    this.timings.modelCallCount++
    this.lastCheckpoint = now
  }

  recordServerTtft() {
    if (this.timings.serverTtftMs === undefined) {
      const now = performance.now()
      this.timings.serverTtftMs = Number(
        (now - this.timings.startTime).toFixed(2)
      )
    }
  }

  incrementToolCall() {
    this.timings.toolCallCount++
  }

  incrementModelCall() {
    this.timings.modelCallCount++
  }

  complete() {
    const now = performance.now()
    this.timings.totalResponseMs = Number(
      (now - this.timings.startTime).toFixed(2)
    )
    this.timings.status = 'completed'
    this.logSummary()
    return this.timings
  }

  fail(error?: unknown) {
    const now = performance.now()
    this.timings.totalResponseMs = Number(
      (now - this.timings.startTime).toFixed(2)
    )
    this.timings.status = 'failed'
    this.timings.errorMessage =
      error instanceof Error ? error.message : String(error)
    this.logSummary()
    return this.timings
  }

  abort() {
    const now = performance.now()
    this.timings.totalResponseMs = Number(
      (now - this.timings.startTime).toFixed(2)
    )
    this.timings.status = 'aborted'
    this.logSummary()
    return this.timings
  }

  getSnapshot(): Readonly<PipelineStageTimings> {
    return { ...this.timings }
  }

  private logSummary() {
    const t = this.timings
    const promptInfo = t.promptCharCount
      ? ` prompt=${t.promptCharCount}c(~${t.promptTokenEstimate}tok)`
      : ''
    const ttftInfo =
      t.serverTtftMs !== undefined ? ` serverTTFT=${t.serverTtftMs}ms` : ''
    const totalInfo =
      t.totalResponseMs !== undefined ? ` total=${t.totalResponseMs}ms` : ''

    console.info(
      `[PipelineTiming] [${t.requestId}] route=${t.route} status=${t.status}${ttftInfo}${totalInfo}${promptInfo} modelCalls=${t.modelCallCount} toolCalls=${t.toolCallCount}`
    )
  }
}
