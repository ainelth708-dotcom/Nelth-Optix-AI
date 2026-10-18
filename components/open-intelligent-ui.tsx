'use client'

import { useEffect, useMemo } from 'react'

import type { ActionEvent } from '@openuidev/react-lang'
import {
  AgentInterface,
  type ChatStorage,
  fetchLLM,
  type Message,
  openAIConversationMessageFormat,
  openAIResponsesAdapter,
  type Thread,
  useThemeModePreference,
  useThread,
  useThreadList
} from '@openuidev/react-ui'
import {
  CalendarDays,
  ChefHat,
  Compass,
  Lightbulb,
  MapPinned,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createSearchStatusWatcher,
  WEB_SEARCH_STATUS_ATTRIBUTE
} from '@/lib/openui/web-search-status'

import { runLibraryAction } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/actions'
import {
  localChatStorage,
  SaveMessages
} from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/chat-storage'
import { webUrl } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/style'
import { library } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/library'

import { NelthLogo } from './ui/nelth-logo'
import { OpenUIAssistantMessage } from './openui-assistant-message'

import '../app/open-intelligent-ui.css'
import '@openuidev/react-ui/styles/index.css'

const OPENUI_CHAT_PATH = '/api/openui/chat'

// While the route runs its web search preload it emits nelth.search.status
// events; the watcher flags <html> so the stylesheet can swap the loading
// shimmer's "Working" label for the web-search one, then back again.
async function watchSearchStatus(stream: ReadableStream<Uint8Array>) {
  const push = createSearchStatusWatcher(searching => {
    document.documentElement.toggleAttribute(
      WEB_SEARCH_STATUS_ATTRIBUTE,
      searching
    )
  })
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      push(decoder.decode(value, { stream: true }))
    }
    push(decoder.decode())
  } catch {
    // Aborted or broken streams simply reset the label below.
  } finally {
    document.documentElement.removeAttribute(WEB_SEARCH_STATUS_ATTRIBUTE)
  }
}

const sniffingFetch: typeof fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init)
  const url = input instanceof Request ? input.url : String(input)
  if (!url.includes(OPENUI_CHAT_PATH) || !response.ok || !response.body) {
    return response
  }

  const [forward, watched] = response.body.tee()
  void watchSearchStatus(watched)
  return new Response(forward, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}

const llm = fetchLLM({
  url: '/api/openui/chat',
  streamAdapter: openAIResponsesAdapter(),
  messageFormat: openAIConversationMessageFormat,
  fetch: sniffingFetch
})

const starters = [
  {
    displayText: 'Organiser un voyage',
    prompt:
      'Organise-moi un séjour de 2 jours à Paris avec des lieux, des photos, une carte et un programme personnalisable.',
    icon: <MapPinned size={16} />
  },
  {
    displayText: 'Découvrir une ville',
    prompt:
      'Propose-moi une journée de visite dans une ville avec plusieurs étapes, des photos et un itinéraire sur une carte.',
    icon: <Compass size={16} />
  },
  {
    displayText: 'Préparer un repas',
    prompt:
      'Aide-moi à préparer un repas simple et équilibré pour quatre personnes, avec une liste de courses interactive.',
    icon: <ChefHat size={16} />
  },
  {
    displayText: 'Créer un calendrier',
    prompt:
      'Crée un programme hebdomadaire personnalisable pour apprendre une nouvelle compétence.',
    icon: <CalendarDays size={16} />
  },
  {
    displayText: 'Comprendre un sujet',
    prompt:
      'Explique-moi clairement un sujet complexe avec des exemples visuels et une courte synthèse.',
    icon: <Lightbulb size={16} />
  },
  {
    displayText: 'Créer quelque chose',
    prompt:
      'Crée une petite expérience interactive que je peux utiliser et personnaliser.',
    icon: <Sparkles size={16} />
  }
]

function errorMessage(response: Response): Promise<string> {
  return response
    .json()
    .then(body =>
      typeof body?.error?.message === 'string'
        ? body.error.message
        : `OpenUI storage request failed (${response.status}).`
    )
    .catch(() => `OpenUI storage request failed (${response.status}).`)
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return response.json() as Promise<T>
}

function databaseChatStorage(): ChatStorage {
  return {
    thread: {
      async listThreads(cursor) {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
        return requestJson<{ threads: Thread[]; nextCursor?: string }>(
          `/api/openui/threads${query}`
        )
      },
      async createThread(firstMessage) {
        const result = await requestJson<{ thread: Thread }>(
          '/api/openui/threads',
          {
            method: 'POST',
            body: JSON.stringify({ message: firstMessage })
          }
        )
        return result.thread
      },
      async getMessages(threadId) {
        const result = await requestJson<{ messages: Message[] }>(
          `/api/openui/threads/${encodeURIComponent(threadId)}`
        )
        return result.messages
      },
      async updateThread(thread) {
        const result = await requestJson<{ thread: Thread }>(
          `/api/openui/threads/${encodeURIComponent(thread.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ title: thread.title })
          }
        )
        return result.thread
      },
      async deleteThread(threadId) {
        await requestJson<{ success: true }>(
          `/api/openui/threads/${encodeURIComponent(threadId)}`,
          { method: 'DELETE' }
        )
      }
    }
  }
}

function SaveDatabaseMessages() {
  const messages = useThread(state => state.messages)
  const isRunning = useThread(state => state.isRunning)
  const threadId = useThreadList(state => state.selectedThreadId)

  useEffect(() => {
    if (!threadId || isRunning || messages.length === 0) return

    void requestJson<{ success: true }>(
      `/api/openui/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ messages })
      }
    ).catch(error => {
      console.error('Unable to save the OpenUI conversation:', error)
      toast.error('Impossible d’enregistrer cette conversation.')
    })
  }, [isRunning, messages, threadId])

  return null
}

function onAction(event: ActionEvent) {
  const result = runLibraryAction(event)
  if (result) {
    void result.then(success => {
      if (!success) toast.error('Impossible d’effectuer cette action.')
    })
  }
}

export function OpenIntelligentUI({ isGuest }: { isGuest: boolean }) {
  const { setPreference, mode } = useThemeModePreference()
  const storage = useMemo(
    () => (isGuest ? localChatStorage() : databaseChatStorage()),
    [isGuest]
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-openui-theme', mode)

    const originalOpen = window.open
    const safeOpen: typeof window.open = (url, target, features) => {
      const safeUrl = webUrl(String(url ?? ''))
      return safeUrl
        ? originalOpen.call(
            window,
            safeUrl,
            target ?? '_blank',
            features ?? 'noopener,noreferrer'
          )
        : null
    }
    window.open = safeOpen

    return () => {
      window.open = originalOpen
    }
  }, [mode])

  return (
    <div className="openui-integration-shell">
      <AgentInterface
        llm={llm}
        storage={storage}
        componentLibrary={library}
        components={{ AssistantMessage: OpenUIAssistantMessage }}
        onAction={onAction}
        agentName="Nelth-IA"
        logoUrl="/nelth-logo.svg"
        theme={{ mode }}
        starters={starters}
      >
        <AgentInterface.SidebarHeader />
        <AgentInterface.SidebarFooter>
          <AgentInterface.ThemeModeToggle
            mode={mode}
            onModeChange={setPreference}
          />
        </AgentInterface.SidebarFooter>
        <AgentInterface.ThreadHeader showChatTitle={false} />
        <AgentInterface.Welcome
          image={
            <NelthLogo
              variant="periodic"
              className="welcome-mascot"
              aria-hidden="true"
            />
          }
          title="Que puis-je faire pour vous ?"
          starterVariant="card"
          glowAnimation
        />
        {isGuest ? <SaveMessages /> : <SaveDatabaseMessages />}
      </AgentInterface>
    </div>
  )
}
