'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/navigation'

import type { ActionEvent } from '@openuidev/react-lang'
import {
  AgentInterface,
  type ChatStorage,
  fetchLLM,
  IconButton,
  type Message,
  openAIConversationMessageFormat,
  openAIResponsesAdapter,
  type Thread,
  useLayoutContext,
  useThemeModePreference,
  useThread,
  useThreadList
} from '@openuidev/react-ui'
import {
  ArrowUp,
  CalendarDays,
  ChefHat,
  Compass,
  Image as ImageIcon,
  Lightbulb,
  MapPinned,
  Plus,
  Sparkles,
  Square
} from 'lucide-react'
import { toast } from 'sonner'

import { ALLOWED_UPLOAD_MIME_TYPES } from '@/lib/constants'
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

/**
 * Mobile layouts anchor the user message at the top and let the answer block
 * grow downwards, so once an answer is taller than the screen the newest
 * streamed words slip below the fold while desktop keeps the run in view.
 * While a run is streaming, keep the mobile scroller pinned to the tail —
 * unless the user scrolls away, and re-arm once they come back to the bottom.
 */
function FollowStreamTail() {
  const isRunning = useThread(state => state.isRunning)

  useEffect(() => {
    if (!isRunning) return

    const scroller = document.querySelector<HTMLElement>(
      '.openui-agent-container--mobile .openui-agent-thread-scroll-area'
    )
    if (!scroller || typeof ResizeObserver === 'undefined') return

    const nearBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 64
    let following = true

    const pinToTail = () => {
      if (following) scroller.scrollTop = scroller.scrollHeight
    }
    const pauseFollowing = () => {
      following = false
    }
    const resumeAtBottom = () => {
      if (!following && nearBottom()) following = true
    }

    const observer = new ResizeObserver(pinToTail)
    const messages = scroller.querySelector('.openui-agent-thread-messages')
    if (messages) observer.observe(messages)
    if (scroller.firstElementChild) {
      observer.observe(scroller.firstElementChild)
    }

    scroller.addEventListener('touchmove', pauseFollowing, { passive: true })
    scroller.addEventListener('wheel', pauseFollowing, { passive: true })
    scroller.addEventListener('scroll', resumeAtBottom, { passive: true })
    pinToTail()

    return () => {
      observer.disconnect()
      scroller.removeEventListener('touchmove', pauseFollowing)
      scroller.removeEventListener('wheel', pauseFollowing)
      scroller.removeEventListener('scroll', resumeAtBottom)
    }
  }, [isRunning])

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

/**
 * Imagine studio entry for the OpenUI agent sidebar.
 * Uses the vendor's `SidebarItem` but with a custom class that makes its
 * expanded-mode style match `NewChatButton` exactly (same height, padding,
 * radius, typography, icon size, gap, hover/active states). Collapsed mode
 * uses the vendor's native SidebarItem behavior (icon-only, 32px, tooltip).
 */
function ImagineSidebarItem() {
  const router = useRouter()

  return (
    <AgentInterface.SidebarItem
      className="openui-agent-primary-action-item"
      icon={<ImageIcon size={14} />}
      onClick={() => router.push('/imagine')}
    >
      Imagine
    </AgentInterface.SidebarItem>
  )
}

/**
 * Custom Composer with file upload button before the textarea.
 * Replicates vendor Composer behavior + adds file attachment button.
 */
function OpenUIComposer() {
  const [textContent, setTextContent] = useState('')
  const [hasInputOverflowTop, setHasInputOverflowTop] = useState(false)
  const [hasInputOverflowBottom, setHasInputOverflowBottom] = useState(false)

  const processMessage = useThread(s => s.processMessage)
  const cancelMessage = useThread(s => s.cancelMessage)
  const isRunning = useThread(s => s.isRunning)
  const isLoadingMessages = useThread(s => s.isLoadingMessages)
  const messages = useThread(s => s.messages)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedThreadId = useThreadList(s => s.selectedThreadId)
  const { layout } = useLayoutContext()
  const isMobile = layout === 'mobile'

  // Auto-focus logic (simplified from vendor's useAutoFocus)
  useEffect(() => {
    if (!isMobile && !isLoadingMessages && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedThreadId, isMobile, isLoadingMessages])

  const updateInputOverflow = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const maxScrollTop = input.scrollHeight - input.clientHeight
    setHasInputOverflowTop(maxScrollTop > 0 && input.scrollTop > 0)
    setHasInputOverflowBottom(
      maxScrollTop > 0 && input.scrollTop < maxScrollTop - 1
    )
  }, [])

  const handleFiles = (files: File[]) => {
    // TODO: integrate with upload pipeline
    // For now, just log the files
    console.log(
      'Files selected:',
      files.map(f => f.name)
    )
  }

  const handleSubmit = useCallback(() => {
    if (!textContent.trim() || isRunning || isLoadingMessages) return
    processMessage({ role: 'user', content: textContent })
    setTextContent('')
  }, [
    textContent,
    isRunning,
    isLoadingMessages,
    processMessage,
    setTextContent
  ])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = '0px'
    input.style.height = `${Math.max(input.scrollHeight, 32)}px`
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateInputOverflow()
  }, [textContent, updateInputOverflow])

  const shouldSubmitOnEnter = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey) return false
    const IME_KEY_CODE = 229
    return !event.nativeEvent.isComposing && event.keyCode !== IME_KEY_CODE
  }

  return (
    <div
      className="openui-agent-thread-composer"
      data-drafting={textContent.length > 0 || undefined}
      onClick={e => {
        if (
          !e.currentTarget
            .querySelector("button, a, [role='button']")
            ?.contains(e.target as Node)
        ) {
          inputRef.current?.focus()
        }
      }}
    >
      <div
        className="openui-agent-thread-composer__input-wrapper"
        data-overflow-top={hasInputOverflowTop || undefined}
        data-overflow-bottom={hasInputOverflowBottom || undefined}
      >
        {/* Attach button - first flex child, before textarea */}
        <button
          type="button"
          className="openui-agent-thread-composer__attach-button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file or image"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_UPLOAD_MIME_TYPES.join(',')}
          hidden
          multiple
          onChange={e => {
            const files = e.target.files
            if (files && files.length > 0) {
              handleFiles(Array.from(files))
            }
            if (e.target) e.target.value = ''
          }}
        />
        {/* Textarea - direct child of input-wrapper with flex: 1 (vendor expectation) */}
        <textarea
          ref={inputRef}
          value={textContent}
          autoFocus
          onChange={e => setTextContent(e.target.value)}
          onScroll={updateInputOverflow}
          className="openui-agent-thread-composer__input"
          placeholder="Ask anything..."
          rows={1}
          onKeyDown={e => {
            if (shouldSubmitOnEnter(e)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        {/* Action bar - direct child of input-wrapper, flex-shrink: 0 (vendor expectation) */}
        <div className="openui-agent-thread-composer__action-bar">
          <IconButton
            onClick={isRunning ? cancelMessage : handleSubmit}
            icon={
              isRunning ? (
                <Square size="1em" fill="currentColor" />
              ) : (
                <ArrowUp size="1em" />
              )
            }
            size="small"
            variant="primary"
            aria-label={isRunning ? 'Cancel message' : 'Send message'}
            className="openui-agent-thread-composer__submit-button"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Custom Welcome Screen with OpenUIComposer (+ button) and starters.
 * Uses only public AgentInterface static properties + local starters.
 */
function OpenUIWelcome({ glowAnimation = false }: { glowAnimation?: boolean }) {
  const { textContent, setTextContent } = useComposerState()
  const processMessage = useThread(s => s.processMessage)
  const isRunning = useThread(s => s.isRunning)
  const isLoadingMessages = useThread(s => s.isLoadingMessages)
  const messages = useThread(s => s.messages)
  const selectedThreadId = useThreadList(s => s.selectedThreadId)

  // Simple chat empty check (replicates vendor isChatEmpty)
  const isEmpty = messages.length === 0 && !isLoadingMessages
  if (!isEmpty) return null

  // Use local starters defined in this file
  const effectiveStarters = starters
  const effectiveVariant = 'card' as const

  return (
    <WelcomeGlowProvider enabled={glowAnimation}>
      <div
        className={`openui-agent-welcome-screen openui-agent-welcome-screen--with-composer ${glowAnimation ? 'openui-agent-welcome-screen--animated' : ''}`}
      >
        <div className="openui-agent-welcome-screen__header">
          <div className="openui-agent-welcome-screen__image-container">
            {welcomeImage}
          </div>
          <div className="openui-agent-welcome-screen__content">
            <h2 className="openui-agent-welcome-screen__title">
              Que puis-je faire pour vous ?
            </h2>
          </div>
        </div>
        <div className="openui-agent-welcome-screen__composer-starters-container">
          <div className="openui-agent-welcome-screen__desktop-composer">
            <OpenUIComposer />
          </div>
          {effectiveStarters.length > 0 && (
            <div className="openui-agent-welcome-screen__desktop-starters">
              {effectiveStarters.map((starter, index) => (
                <button
                  key={index}
                  type="button"
                  className="openui-agent-conversation-starter-item-card"
                  onClick={() => {
                    if (isRunning) return
                    processMessage({ role: 'user', content: starter.prompt })
                  }}
                  disabled={isRunning}
                >
                  {starter.icon && (
                    <span className="openui-agent-conversation-starter-item-card__icon">
                      {starter.icon}
                    </span>
                  )}
                  <span className="openui-agent-conversation-starter-item-card__text">
                    {starter.displayText}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </WelcomeGlowProvider>
  )
}

// Import vendor hooks/components from dist paths
import { WelcomeGlowProvider } from '@openuidev/react-ui/dist/components/AgentInterface/WelcomeGlow'
import { useComposerState } from '@openuidev/react-ui/dist/hooks/useComposerState'

const welcomeImage = (
  <NelthLogo variant="periodic" className="welcome-mascot" aria-hidden="true" />
)

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
        <AgentInterface.Composer>
          <OpenUIComposer />
        </AgentInterface.Composer>
        {/* Sidebar composed manually (vendor "Mode C") to keep the default
            arrangement and add the Imagine item below the thread list — the
            vendor component is never modified. */}
        <AgentInterface.Sidebar>
          <div className="openui-agent-sidebar-actions">
            <AgentInterface.SidebarHeader />
            <div className="openui-agent-sidebar-primary-actions">
              <AgentInterface.NewChatButton />
              <AgentInterface.HistoryButton />
              <ImagineSidebarItem />
              <AgentInterface.ArtifactNav className="openui-agent-sidebar-artifact-nav" />
            </div>
          </div>
          <AgentInterface.SidebarContent>
            <AgentInterface.ThreadList />
          </AgentInterface.SidebarContent>
          <AgentInterface.SidebarFooter>
            <AgentInterface.ThemeModeToggle
              mode={mode}
              onModeChange={setPreference}
            />
          </AgentInterface.SidebarFooter>
        </AgentInterface.Sidebar>
        <AgentInterface.ThreadHeader showChatTitle={false} />
        <AgentInterface.Welcome>
          <OpenUIWelcome glowAnimation />
        </AgentInterface.Welcome>
        {isGuest ? <SaveMessages /> : <SaveDatabaseMessages />}
        <FollowStreamTail />
      </AgentInterface>
    </div>
  )
}
