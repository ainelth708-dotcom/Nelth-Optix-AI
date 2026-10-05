// ---------------------------------------------------------------------------
// Agent stores (goals, memories, feed) on the EXISTING Firestore backend
// (lib/firebase/admin) — no second database. Per-user collections; guests
// share the anonymous bucket (documented limitation).
// ---------------------------------------------------------------------------

import { getDb } from '@/lib/firebase/admin'

import type { AgentSchedule } from './scheduling'
import type { AgentTask } from './task'

export interface AgentGoal {
  id: string
  title: string
  objective: string
  status: 'active' | 'paused' | 'done'
  progress: number
  createdAt: number
  updatedAt: number
}

export interface AgentMemory {
  id: string
  text: string
  createdAt: number
}

export interface AgentFeedItem {
  id: string
  kind: 'task' | 'goal' | 'discovery' | 'system'
  text: string
  createdAt: number
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function userCol(
  uid: string,
  name: 'agentGoals' | 'agentMemories' | 'agentFeed'
) {
  return getDb().collection('users').doc(uid).collection(name)
}

function toGoal(id: string, data: FirebaseFirestore.DocumentData): AgentGoal {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Objectif',
    objective: typeof data.objective === 'string' ? data.objective : '',
    status:
      data.status === 'paused' || data.status === 'done'
        ? data.status
        : 'active',
    progress:
      typeof data.progress === 'number'
        ? Math.min(100, Math.max(0, data.progress))
        : 0,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0
  }
}

export async function listGoals(uid: string): Promise<AgentGoal[]> {
  const snap = await userCol(uid, 'agentGoals')
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map(d => toGoal(d.id, d.data()))
}

export async function createGoal(
  uid: string,
  input: { title: string; objective?: string }
): Promise<AgentGoal> {
  const now = Date.now()
  const ref = userCol(uid, 'agentGoals').doc()
  const goal: AgentGoal = {
    id: ref.id,
    title: input.title.trim().slice(0, 120) || 'Objectif',
    objective: (input.objective ?? '').trim().slice(0, 1000),
    status: 'active',
    progress: 0,
    createdAt: now,
    updatedAt: now
  }
  await ref.set(goal)
  return goal
}

export async function updateGoal(
  uid: string,
  id: string,
  patch: Partial<Pick<AgentGoal, 'title' | 'objective' | 'status' | 'progress'>>
): Promise<AgentGoal | null> {
  const ref = userCol(uid, 'agentGoals').doc(id)
  const snap = await ref.get()
  if (!snap.exists) return null
  const clean: Record<string, unknown> = { updatedAt: Date.now() }
  if (typeof patch.title === 'string') clean.title = patch.title.slice(0, 120)
  if (typeof patch.objective === 'string') {
    clean.objective = patch.objective.slice(0, 1000)
  }
  if (
    patch.status === 'active' ||
    patch.status === 'paused' ||
    patch.status === 'done'
  ) {
    clean.status = patch.status
  }
  if (typeof patch.progress === 'number') {
    clean.progress = Math.min(100, Math.max(0, patch.progress))
  }
  await ref.update(clean)
  const updated = await ref.get()
  return toGoal(id, updated.data() ?? {})
}

export async function deleteGoal(uid: string, id: string): Promise<boolean> {
  const ref = userCol(uid, 'agentGoals').doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

export async function listMemories(uid: string): Promise<AgentMemory[]> {
  const snap = await userCol(uid, 'agentMemories')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return snap.docs.map(d => ({
    id: d.id,
    text: typeof d.data().text === 'string' ? (d.data().text as string) : '',
    createdAt:
      typeof d.data().createdAt === 'number'
        ? (d.data().createdAt as number)
        : 0
  }))
}

export async function addMemory(
  uid: string,
  text: string
): Promise<AgentMemory> {
  const clean = text.trim().slice(0, 2000)
  if (!clean) throw new Error('Souvenir vide.')
  const ref = userCol(uid, 'agentMemories').doc()
  const memory: AgentMemory = { id: ref.id, text: clean, createdAt: Date.now() }
  await ref.set(memory)
  return memory
}

export async function deleteMemory(uid: string, id: string): Promise<boolean> {
  const ref = userCol(uid, 'agentMemories').doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

export async function listFeed(uid: string): Promise<AgentFeedItem[]> {
  const snap = await userCol(uid, 'agentFeed')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      kind:
        data.kind === 'goal' ||
        data.kind === 'discovery' ||
        data.kind === 'system'
          ? data.kind
          : 'task',
      text: typeof data.text === 'string' ? data.text : '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0
    }
  })
}

/** Feed is written ONLY by real agent events (completions, goals). */
export async function appendFeed(
  uid: string,
  input: { kind: AgentFeedItem['kind']; text: string }
): Promise<AgentFeedItem> {
  const clean = input.text.trim().slice(0, 500)
  if (!clean) throw new Error('Élément vide.')
  const ref = userCol(uid, 'agentFeed').doc()
  const item: AgentFeedItem = {
    id: ref.id,
    kind: input.kind,
    text: clean,
    createdAt: Date.now()
  }
  await ref.set(item)
  return item
}

// ---------------------------------------------------------------------------
// Persisted agent tasks (snapshots for resume-across-HTTP) + schedules.
// ---------------------------------------------------------------------------

export async function saveAgentTask(
  uid: string,
  task: AgentTask
): Promise<void> {
  await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentTasks')
    .doc(task.id)
    .set({ ...task })
}

export async function getAgentTask(
  uid: string,
  id: string
): Promise<AgentTask | null> {
  const snap = await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentTasks')
    .doc(id)
    .get()
  if (!snap.exists) return null
  return snap.data() as AgentTask
}

export async function listAgentTasks(
  uid: string,
  limit = 20
): Promise<AgentTask[]> {
  const snap = await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentTasks')
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(50, Math.max(1, limit)))
    .get()
  return snap.docs.map(d => d.data() as AgentTask)
}

export async function listActiveAgentTasks(uid: string): Promise<AgentTask[]> {
  const snap = await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentTasks')
    .where('state', 'in', [
      'PLANNING',
      'RUNNING',
      'BROWSING',
      'USING_TOOL',
      'VERIFYING',
      'WAITING_APPROVAL',
      'WAITING_USER',
      'PAUSED'
    ])
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map(d => d.data() as AgentTask)
}

export async function listSchedules(uid: string): Promise<AgentSchedule[]> {
  const snap = await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentSchedules')
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map(
    d => ({ id: d.id, ...(d.data() as object) }) as AgentSchedule
  )
}

export async function saveSchedule(
  uid: string,
  schedule: AgentSchedule
): Promise<void> {
  await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentSchedules')
    .doc(schedule.id)
    .set({ ...schedule })
}

export async function getSchedule(
  uid: string,
  id: string
): Promise<AgentSchedule | null> {
  const snap = await getDb()
    .collection('users')
    .doc(uid)
    .collection('agentSchedules')
    .doc(id)
    .get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as object) } as AgentSchedule
}

export async function deleteSchedule(
  uid: string,
  id: string
): Promise<boolean> {
  const ref = getDb()
    .collection('users')
    .doc(uid)
    .collection('agentSchedules')
    .doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}
