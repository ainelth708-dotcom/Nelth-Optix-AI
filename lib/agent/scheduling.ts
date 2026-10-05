// Scheduling data structures on the EXISTING Firestore backend.
// Supports one-time (runAt), interval-based recurring (intervalHours) and
// standard 5-field cron expressions (UTC unless timezone given).
// A minimal cron subset is parsed below — no extra dependency.

export interface AgentSchedule {
  id: string
  title: string
  goal: string
  enabled: boolean
  /** 'once' | 'interval' | 'cron' */
  type: 'once' | 'interval' | 'cron'
  /** ISO timestamp for one-time schedules. */
  runAt: number | null
  /** Hours between runs for interval schedules. */
  intervalHours: number | null
  /** Standard 5-field cron for cron schedules. */
  cron: string | null
  timezone: string | null
  nextRunAt: number | null
  lastRunAt: number | null
  createdAt: number
  updatedAt: number
}

export function newScheduleId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sched-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

type CronField = { kind: 'any' } | { kind: 'set'; values: number[] }

function parseCronField(
  raw: string,
  min: number,
  max: number
): CronField | null {
  const field = raw.trim()
  if (field === '*') return { kind: 'any' }
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(?:\*|(\d+)(?:-(\d+))?)\/(\d+)$/)
    if (stepMatch) {
      const step = Number(stepMatch[3])
      if (!Number.isInteger(step) || step <= 0) return null
      const from = stepMatch[1] !== undefined ? Number(stepMatch[1]) : min
      const to = stepMatch[2] !== undefined ? Number(stepMatch[2]) : max
      if (from < min || to > max || from > to) return null
      for (let v = from; v <= to; v += step) values.add(v)
      continue
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const from = Number(rangeMatch[1])
      const to = Number(rangeMatch[2])
      if (from < min || to > max || from > to) return null
      for (let v = from; v <= to; v++) values.add(v)
      continue
    }
    if (/^\d+$/.test(part)) {
      const v = Number(part)
      if (v < min || v > max) return null
      values.add(v)
      continue
    }
    return null
  }
  if (values.size === 0) return null
  return { kind: 'set', values: [...values].sort((a, b) => a - b) }
}

export interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const parsed: (CronField | null)[] = [
    parseCronField(minute, 0, 59),
    parseCronField(hour, 0, 23),
    parseCronField(dayOfMonth, 1, 31),
    parseCronField(month, 1, 12),
    parseCronField(dayOfWeek, 0, 6)
  ]
  if (parsed.some(p => p === null)) return null
  return {
    minute: parsed[0] as CronField,
    hour: parsed[1] as CronField,
    dayOfMonth: parsed[2] as CronField,
    month: parsed[3] as CronField,
    dayOfWeek: parsed[4] as CronField
  }
}

function fieldMatches(field: CronField, value: number): boolean {
  if (field.kind === 'any') return true
  return field.values.includes(value)
}

/**
 * Next UTC timestamp (ms) strictly after `from` matching the expression.
 * Scans minute-by-minute up to ~366 days ahead; null when unparseable or
 * nothing matches in range.
 */
export function nextCronRun(expr: string, from: number): number | null {
  const parsed = parseCron(expr)
  if (!parsed) return null
  const start = Math.floor(from / 60000) * 60000 + 60000
  for (let t = start; t < start + 366 * 24 * 60 * 60000; t += 60000) {
    const d = new Date(t)
    if (
      fieldMatches(parsed.minute, d.getUTCMinutes()) &&
      fieldMatches(parsed.hour, d.getUTCHours()) &&
      fieldMatches(parsed.dayOfMonth, d.getUTCDate()) &&
      fieldMatches(parsed.month, d.getUTCMonth() + 1) &&
      fieldMatches(parsed.dayOfWeek, d.getUTCDay())
    ) {
      return t
    }
  }
  return null
}

/** Compute the next run for any schedule kind (pure, tested). */
export function computeNextRun(
  schedule: Pick<
    AgentSchedule,
    'type' | 'runAt' | 'intervalHours' | 'cron' | 'lastRunAt'
  > & { enabled?: boolean },
  now: number = Date.now()
): number | null {
  if (schedule.type === 'once') {
    if (typeof schedule.runAt !== 'number') return null
    return schedule.runAt > now ? schedule.runAt : null
  }
  if (schedule.type === 'interval') {
    if (
      typeof schedule.intervalHours !== 'number' ||
      schedule.intervalHours <= 0
    ) {
      return null
    }
    const base =
      typeof schedule.lastRunAt === 'number' && schedule.lastRunAt <= now
        ? schedule.lastRunAt
        : now
    return base + schedule.intervalHours * 3600 * 1000
  }
  if (schedule.type === 'cron') {
    if (typeof schedule.cron !== 'string') return null
    return nextCronRun(schedule.cron, now)
  }
  return null
}

export function validateScheduleInput(input: {
  title?: unknown
  goal?: unknown
  type?: unknown
  runAt?: unknown
  intervalHours?: unknown
  cron?: unknown
  timezone?: unknown
  enabled?: unknown
}):
  | {
      ok: true
      value: Omit<AgentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt'>
    }
  | { ok: false; error: string } {
  const title =
    typeof input.title === 'string' ? input.title.trim().slice(0, 120) : ''
  const goalText =
    typeof input.goal === 'string' ? input.goal.trim().slice(0, 2000) : ''
  if (!title) return { ok: false, error: 'Titre requis.' }
  if (!goalText) return { ok: false, error: 'Objectif requis.' }
  const type =
    input.type === 'interval' || input.type === 'cron' ? input.type : 'once'
  if (type === 'once') {
    const runAt = typeof input.runAt === 'number' ? input.runAt : NaN
    if (!Number.isFinite(runAt) || runAt <= Date.now()) {
      return { ok: false, error: 'runAt doit être un timestamp futur.' }
    }
    return {
      ok: true,
      value: {
        title,
        goal: goalText,
        enabled: input.enabled !== false,
        type,
        runAt,
        intervalHours: null,
        cron: null,
        timezone:
          typeof input.timezone === 'string'
            ? input.timezone.slice(0, 60)
            : null,
        nextRunAt: runAt
      }
    }
  }
  if (type === 'interval') {
    const intervalHours =
      typeof input.intervalHours === 'number' ? input.intervalHours : NaN
    if (
      !Number.isFinite(intervalHours) ||
      intervalHours <= 0 ||
      intervalHours > 24 * 31
    ) {
      return { ok: false, error: 'intervalHours doit être entre 0 et 744.' }
    }
    return {
      ok: true,
      value: {
        title,
        goal: goalText,
        enabled: input.enabled !== false,
        type,
        runAt: null,
        intervalHours,
        cron: null,
        timezone:
          typeof input.timezone === 'string'
            ? input.timezone.slice(0, 60)
            : null,
        nextRunAt: Date.now() + intervalHours * 3600 * 1000
      }
    }
  }
  const cron = typeof input.cron === 'string' ? input.cron.trim() : ''
  if (!parseCron(cron)) {
    return { ok: false, error: 'Expression cron invalide (5 champs).' }
  }
  return {
    ok: true,
    value: {
      title,
      goal: goalText,
      enabled: input.enabled !== false,
      type,
      runAt: null,
      intervalHours: null,
      cron,
      timezone:
        typeof input.timezone === 'string' ? input.timezone.slice(0, 60) : null,
      nextRunAt: nextCronRun(cron, Date.now())
    }
  }
}
