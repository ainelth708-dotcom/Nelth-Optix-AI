'use client'

import { useCallback, useEffect, useState } from 'react'

import { Check, Loader2, Plus, Trash2 } from 'lucide-react'

import type { AgentFeedItem, AgentGoal, AgentMemory } from '@/lib/agent/store'
import { cn } from '@/lib/utils'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  const json = (await res.json().catch(() => null)) as
    | (T & {
        error?: string
      })
    | null
  if (!res.ok || !json) {
    throw new Error(
      (json as { error?: string } | null)?.error ??
        `Requête refusée (${res.status}).`
    )
  }
  return json as T
}

/**
 * Tracking tabs: goals, memories and feed backed by the REAL Firestore
 * stores (lib/agent/store.ts). 401 → sign-in hint (guests stay ephemeral).
 */
export function TrackingPanel() {
  const [tab, setTab] = useState<'goals' | 'memory' | 'feed'>('goals')
  const [goals, setGoals] = useState<AgentGoal[]>([])
  const [memories, setMemories] = useState<AgentMemory[]>([])
  const [feed, setFeed] = useState<AgentFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalObjective, setGoalObjective] = useState('')
  const [memoryText, setMemoryText] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [g, m, f] = await Promise.all([
        api<{ goals: AgentGoal[] }>('/api/agent/goals'),
        api<{ memories: AgentMemory[] }>('/api/agent/memories'),
        api<{ feed: AgentFeedItem[] }>('/api/agent/feed')
      ])
      setGoals(g.goals)
      setMemories(m.memories)
      setFeed(f.feed)
      setLocked(false)
    } catch (err) {
      if (err instanceof Error && /401|connecté/i.test(err.message)) {
        setLocked(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addGoal = async () => {
    if (!goalTitle.trim()) return
    const json = await api<{ goal: AgentGoal }>('/api/agent/goals', {
      method: 'POST',
      body: JSON.stringify({ title: goalTitle, objective: goalObjective })
    }).catch(() => null)
    if (json) {
      setGoalTitle('')
      setGoalObjective('')
      void refresh()
    }
  }

  const toggleGoal = async (goal: AgentGoal) => {
    const done = goal.status !== 'done'
    await api('/api/agent/goals', {
      method: 'PATCH',
      body: JSON.stringify({
        id: goal.id,
        status: done ? 'done' : 'active',
        progress: done ? 100 : 0
      })
    }).catch(() => null)
    void refresh()
  }

  const removeGoal = async (id: string) => {
    await fetch(`/api/agent/goals?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => null)
    void refresh()
  }

  const addMem = async () => {
    if (!memoryText.trim()) return
    const json = await api<{ memory: AgentMemory }>('/api/agent/memories', {
      method: 'POST',
      body: JSON.stringify({ text: memoryText })
    }).catch(() => null)
    if (json) {
      setMemoryText('')
      void refresh()
    }
  }

  const removeMem = async (id: string) => {
    await fetch(`/api/agent/memories?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => null)
    void refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <div className="flex gap-1 pb-3">
        {(
          [
            ['goals', 'Objectifs'],
            ['memory', 'Mémoire'],
            ['feed', 'Fil']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              tab === id
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
            <Loader2 size={15} className="animate-spin" />
            Chargement…
          </div>
        ) : locked ? (
          <p className="py-6 text-sm text-neutral-500 dark:text-neutral-400">
            Connecte-toi pour synchroniser objectifs, mémoire et fil.
          </p>
        ) : tab === 'goals' ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-[16px] border border-[#e3e3e3] bg-white p-3 dark:border-border dark:bg-card">
              <input
                value={goalTitle}
                onChange={e => setGoalTitle(e.target.value)}
                placeholder="Nouvel objectif…"
                className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-[#707070]"
              />
              <input
                value={goalObjective}
                onChange={e => setGoalObjective(e.target.value)}
                placeholder="Détail (optionnel)…"
                className="mt-1 w-full bg-transparent text-[13px] outline-none placeholder:text-[#707070]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={addGoal}
                  disabled={!goalTitle.trim()}
                  className="flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  <Plus size={13} />
                  Ajouter
                </button>
              </div>
            </div>
            {goals.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">
                Aucun objectif pour l’instant.
              </p>
            )}
            {goals.map(g => (
              <div
                key={g.id}
                className="flex items-start gap-2.5 rounded-[16px] border border-[#e3e3e3] bg-white p-3 dark:border-border dark:bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggleGoal(g)}
                  aria-label={g.status === 'done' ? 'Rouvrir' : 'Terminer'}
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    g.status === 'done'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black/10 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'
                  )}
                >
                  {g.status === 'done' && <Check size={12} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[13.5px] font-medium leading-snug',
                      g.status === 'done' &&
                        'text-neutral-400 line-through dark:text-neutral-500'
                    )}
                  >
                    {g.title}
                  </p>
                  {g.objective && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {g.objective}
                    </p>
                  )}
                  {g.status === 'active' && g.progress > 0 && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-black dark:bg-white"
                        style={{ width: `${g.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeGoal(g.id)}
                  aria-label="Supprimer"
                  className="shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : tab === 'memory' ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 rounded-[16px] border border-[#e3e3e3] bg-white p-3 dark:border-border dark:bg-card">
              <input
                value={memoryText}
                onChange={e => setMemoryText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addMem()
                }}
                placeholder="L’agent doit se souvenir que…"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#707070]"
              />
              <button
                type="button"
                onClick={addMem}
                disabled={!memoryText.trim()}
                className="shrink-0 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                Ajouter
              </button>
            </div>
            {memories.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">
                Aucun souvenir pour l’instant.
              </p>
            )}
            {memories.map(m => (
              <div
                key={m.id}
                className="flex items-start gap-2 rounded-[16px] border border-[#e3e3e3] bg-white p-3 dark:border-border dark:bg-card"
              >
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {m.text}
                </p>
                <button
                  type="button"
                  onClick={() => removeMem(m.id)}
                  aria-label="Supprimer"
                  className="shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {feed.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">
                Rien pour l’instant — le fil se remplit à chaque tâche réelle.
              </p>
            )}
            {feed.map(f => (
              <div
                key={f.id}
                className="rounded-[16px] border border-[#e3e3e3] bg-white p-3 dark:border-border dark:bg-card"
              >
                <p className="text-[13.5px] leading-relaxed">{f.text}</p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  {new Date(f.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
