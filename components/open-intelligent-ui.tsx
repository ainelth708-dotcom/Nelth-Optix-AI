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
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MapPinned,
  Plus,
  Presentation,
  Sparkles,
  Square,
  X
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

// ---------------------------------------------------------------------------
// Attachments — ChatGPT-style previews inside the composers.
// Files are previewed immediately (object URLs, revoked on remove/unmount);
// uploading happens at send time through the existing /api/upload pipeline and
// the returned URLs are embedded in the outgoing message content.
// ---------------------------------------------------------------------------

interface PendingAttachment {
  id: string
  file: File
  /** Object URL for image thumbnails — revoked when removed or unmounted. */
  previewUrl?: string
}

interface UploadedAttachment {
  name: string
  url: string
  mediaType: string
  size: number
}

/** Mirrors MAX_FILE_SIZE in app/api/upload/route.ts. */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

function formatAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

function describeAttachment(item: PendingAttachment): string {
  const extension = item.file.name.split('.').pop()?.toUpperCase()
  const kind = extension && extension.length <= 5 ? extension : 'FICHIER'
  return `${kind} · ${formatAttachmentSize(item.file.size)}`
}

/** Embeds the uploaded files into the message content (classic-style block). */
function buildMessageWithAttachments(
  text: string,
  uploads: UploadedAttachment[]
): string {
  if (uploads.length === 0) return text
  const lines = uploads.map(
    (file, index) =>
      `${index + 1}. ${file.name} (${file.mediaType}${
        file.size > 0 ? `, ${formatAttachmentSize(file.size)}` : ''
      }) — ${file.url}`
  )
  const label = uploads.length === 1 ? 'ATTACHED FILE' : 'ATTACHED FILES'
  return `${text}${text ? '\n\n' : ''}[${label}]\n${lines.join('\n')}\n[/${label}]`
}

function AttachmentFileIcon({ item }: { item: PendingAttachment }) {
  const { type } = item.file
  if (type.startsWith('image/')) {
    return <ImageIcon size={16} aria-hidden="true" />
  }
  if (type === 'application/pdf') {
    return <FileText size={16} aria-hidden="true" />
  }
  if (type.includes('spreadsheet')) {
    return <FileSpreadsheet size={16} aria-hidden="true" />
  }
  if (type.includes('presentation')) {
    return <Presentation size={16} aria-hidden="true" />
  }
  return <FileIcon size={16} aria-hidden="true" />
}

function OpenUIAttachmentStrip({
  attachments,
  onRemove
}: {
  attachments: PendingAttachment[]
  onRemove: (id: string) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="openui-attachment-strip">
      <ul className="openui-attachment-list">
        {attachments.map(item => (
          <li key={item.id} className="openui-attachment-item">
            {item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview while composing
              <img
                src={item.previewUrl}
                alt=""
                className="openui-attachment-thumb"
              />
            ) : (
              <span className="openui-attachment-icon">
                <AttachmentFileIcon item={item} />
              </span>
            )}
            <span className="openui-attachment-meta">
              <span className="openui-attachment-name" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="openui-attachment-detail">
                {describeAttachment(item)}
              </span>
            </span>
            <button
              type="button"
              className="openui-attachment-remove"
              onClick={() => onRemove(item.id)}
              aria-label={`Supprimer la pièce jointe ${item.file.name}`}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OpenUIFileInput({
  inputRef,
  onFiles
}: {
  inputRef: React.RefObject<HTMLInputElement>
  onFiles: (files: File[]) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={ALLOWED_UPLOAD_MIME_TYPES.join(',')}
      hidden
      multiple
      onChange={e => {
        const files = e.target.files
        if (files && files.length > 0) {
          onFiles(Array.from(files))
        }
        if (e.target) e.target.value = ''
      }}
    />
  )
}

function useOpenUIAttachments() {
  const [attachments, setAttachmentsState] = useState<PendingAttachment[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentsRef = useRef<PendingAttachment[]>([])

  const setAttachments = useCallback((next: PendingAttachment[]) => {
    attachmentsRef.current = next
    setAttachmentsState(next)
  }, [])

  // Revoke any leftover object URLs when the composer unmounts.
  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
    }
  }, [])

  const addFiles = useCallback(
    (incoming: File[]) => {
      const next = [...attachmentsRef.current]
      for (const file of incoming) {
        if (
          !(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)
        ) {
          toast.error(`Format non pris en charge : ${file.name}`)
          continue
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`Fichier trop volumineux (20 Mo max) : ${file.name}`)
          continue
        }
        if (
          next.some(
            attachment =>
              attachment.file.name === file.name &&
              attachment.file.size === file.size
          )
        ) {
          continue
        }
        next.push({
          id: `${Date.now().toString(36)}-${next.length}-${file.name}`,
          file,
          previewUrl: file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined
        })
      }
      setAttachments(next)
    },
    [setAttachments]
  )

  const removeAttachment = useCallback(
    (id: string) => {
      const target = attachmentsRef.current.find(
        attachment => attachment.id === id
      )
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      setAttachments(
        attachmentsRef.current.filter(attachment => attachment.id !== id)
      )
    },
    [setAttachments]
  )

  const clearAttachments = useCallback(() => {
    for (const attachment of attachmentsRef.current) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
    }
    setAttachments([])
  }, [setAttachments])

  // Uploads each pending file through the existing /api/upload pipeline, one
  // by one; failed uploads are individually notified and simply excluded from
  // the outgoing message (the send itself is never blocked by one bad file).
  const uploadAttachments = useCallback(async (chatId: string | null) => {
    const uploads: UploadedAttachment[] = []
    for (const attachment of attachmentsRef.current) {
      try {
        const formData = new FormData()
        formData.append('file', attachment.file)
        if (chatId) formData.append('chatId', chatId)
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('LOGIN_REQUIRED')
          }
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as {
          file?: {
            filename?: string
            url?: string
            mediaType?: string
            size?: number
          }
        }
        if (!data.file?.url) {
          throw new Error('MISSING_URL')
        }
        uploads.push({
          name: data.file.filename ?? attachment.file.name,
          url: data.file.url,
          mediaType: data.file.mediaType ?? attachment.file.type,
          size: data.file.size ?? attachment.file.size
        })
      } catch (error) {
        if (error instanceof Error && error.message === 'LOGIN_REQUIRED') {
          toast.error('Connectez-vous pour joindre des fichiers.')
        } else {
          toast.error(`Envoi impossible : ${attachment.file.name}`)
        }
      }
    }
    return uploads
  }, [])

  return {
    attachments,
    isDraggingOver,
    setIsDraggingOver,
    addFiles,
    removeAttachment,
    clearAttachments,
    uploadAttachments,
    fileInputRef
  }
}

/**
 * Custom Composer for Welcome Screen with file upload button.
 * Uses vendor welcome screen CSS classes (`.openui-agent-desktop-welcome-composer*`).
 */
function OpenUIWelcomeComposer() {
  const [textContent, setTextContent] = useState('')
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const {
    attachments,
    isDraggingOver,
    setIsDraggingOver,
    addFiles,
    removeAttachment,
    clearAttachments,
    uploadAttachments,
    fileInputRef
  } = useOpenUIAttachments()

  const processMessage = useThread(s => s.processMessage)
  const cancelMessage = useThread(s => s.cancelMessage)
  const isRunning = useThread(s => s.isRunning)
  const isLoadingMessages = useThread(s => s.isLoadingMessages)
  const messages = useThread(s => s.messages)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const selectedThreadId = useThreadList(s => s.selectedThreadId)
  const { layout } = useLayoutContext()
  const isMobile = layout === 'mobile'

  // Auto-focus logic (simplified from vendor's useAutoFocus — no mobile focus)
  useEffect(() => {
    if (!isMobile && !isLoadingMessages && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedThreadId, isMobile, isLoadingMessages])

  // Auto-grow textarea (vendor DesktopWelcomeComposer behavior)
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    // Reset to 0 (not "auto") so scrollHeight reflects content, not container
    input.style.height = '0px'
    input.style.height = `${Math.max(input.scrollHeight, 32)}px`
  }, [textContent])

  const handleSubmit = useCallback(async () => {
    if (isRunning || isLoadingMessages || isUploadingFiles) return
    const text = textContent.trim()
    if (!text && attachments.length === 0) return
    setIsUploadingFiles(true)
    try {
      // Upload at send time (preview is always instant); succeeded files are
      // embedded in the message so the backend pipeline receives their URLs.
      const uploads = await uploadAttachments(selectedThreadId)
      if (uploads.length > 0 || text.length > 0) {
        processMessage({
          role: 'user',
          content: buildMessageWithAttachments(text, uploads)
        })
      }
      clearAttachments()
      setTextContent('')
    } finally {
      setIsUploadingFiles(false)
    }
  }, [
    textContent,
    attachments,
    isRunning,
    isLoadingMessages,
    isUploadingFiles,
    selectedThreadId,
    uploadAttachments,
    clearAttachments,
    processMessage
  ])

  const shouldSubmitOnEnter = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey) return false
    const IME_KEY_CODE = 229
    return !event.nativeEvent.isComposing && event.keyCode !== IME_KEY_CODE
  }

  return (
    <div
      className={`openui-agent-desktop-welcome-composer${
        isDraggingOver ? ' openui-drop-active' : ''
      }`}
      data-drafting={textContent.length > 0 || undefined}
      onDragOver={e => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragLeave={e => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setIsDraggingOver(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setIsDraggingOver(false)
        if (e.dataTransfer.files.length > 0) {
          addFiles(Array.from(e.dataTransfer.files))
        }
      }}
    >
      <OpenUIAttachmentStrip
        attachments={attachments}
        onRemove={removeAttachment}
      />
      <button
        type="button"
        className="openui-agent-desktop-welcome-composer__attach-button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Attach file or image"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
      <OpenUIFileInput inputRef={fileInputRef} onFiles={addFiles} />
      {/* Textarea - flex: 1, matches vendor desktop welcome composer */}
      <textarea
        ref={inputRef}
        value={textContent}
        onChange={e => setTextContent(e.target.value)}
        className="openui-agent-desktop-welcome-composer__input"
        placeholder="Ask anything..."
        rows={1}
        onKeyDown={e => {
          if (shouldSubmitOnEnter(e)) {
            e.preventDefault()
            void handleSubmit()
          }
        }}
      />
      {/* Action bar - matches vendor desktop welcome composer */}
      <div className="openui-agent-desktop-welcome-composer__action-bar">
        <IconButton
          onClick={isRunning ? cancelMessage : () => void handleSubmit()}
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
          className="openui-agent-desktop-welcome-composer__submit-button"
          disabled={
            isUploadingFiles ||
            (!textContent.trim() && attachments.length === 0 && !isRunning)
          }
        />
      </div>
    </div>
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
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const {
    attachments,
    isDraggingOver,
    setIsDraggingOver,
    addFiles,
    removeAttachment,
    clearAttachments,
    uploadAttachments,
    fileInputRef
  } = useOpenUIAttachments()

  const processMessage = useThread(s => s.processMessage)
  const cancelMessage = useThread(s => s.cancelMessage)
  const isRunning = useThread(s => s.isRunning)
  const isLoadingMessages = useThread(s => s.isLoadingMessages)
  const messages = useThread(s => s.messages)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  const handleSubmit = useCallback(async () => {
    if (isRunning || isLoadingMessages || isUploadingFiles) return
    const text = textContent.trim()
    if (!text && attachments.length === 0) return
    setIsUploadingFiles(true)
    try {
      // Upload at send time (preview is always instant); succeeded files are
      // embedded in the message so the backend pipeline receives their URLs.
      const uploads = await uploadAttachments(selectedThreadId)
      if (uploads.length > 0 || text.length > 0) {
        processMessage({
          role: 'user',
          content: buildMessageWithAttachments(text, uploads)
        })
      }
      clearAttachments()
      setTextContent('')
    } finally {
      setIsUploadingFiles(false)
    }
  }, [
    textContent,
    attachments,
    isRunning,
    isLoadingMessages,
    isUploadingFiles,
    selectedThreadId,
    uploadAttachments,
    clearAttachments,
    processMessage
  ])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = '0px'
    input.style.height = `${Math.max(input.scrollHeight, 32)}px`
     
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
        className={`openui-agent-thread-composer__input-wrapper${
          isDraggingOver ? ' openui-drop-active' : ''
        }`}
        data-overflow-top={hasInputOverflowTop || undefined}
        data-overflow-bottom={hasInputOverflowBottom || undefined}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={e => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDraggingOver(false)
        }}
        onDrop={e => {
          e.preventDefault()
          setIsDraggingOver(false)
          if (e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files))
          }
        }}
      >
        <OpenUIAttachmentStrip
          attachments={attachments}
          onRemove={removeAttachment}
        />
        {/* Attach button - first flex child, before textarea */}
        <button
          type="button"
          className="openui-agent-thread-composer__attach-button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file or image"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <OpenUIFileInput inputRef={fileInputRef} onFiles={addFiles} />
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
              void handleSubmit()
            }
          }}
        />
        {/* Action bar - direct child of input-wrapper, flex-shrink: 0 (vendor expectation) */}
        <div className="openui-agent-thread-composer__action-bar">
          <IconButton
            onClick={isRunning ? cancelMessage : () => void handleSubmit()}
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
            disabled={
              isUploadingFiles ||
              (!textContent.trim() && attachments.length === 0 && !isRunning)
            }
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Custom Welcome Screen content for the `AgentInterface.Welcome` slot
 * (children mode). The vendor wrapper supplies the `openui-agent-welcome-screen`
 * root, the `--with-composer` modifier (passed via className), the glow
 * provider and the chat-empty gate — this renders only the vendor DOM shape:
 * header + composer (with + attach button) + card starters via the vendor
 * `ConversationStarter` (variant "card", same as the app config).
 */
function OpenUIWelcome() {
  return (
    <>
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
          <AgentInterface.WelcomeGlow>
            <OpenUIWelcomeComposer />
          </AgentInterface.WelcomeGlow>
        </div>
        <div className="openui-agent-welcome-screen__desktop-starters">
          <ConversationStarter starters={starters} variant="card" />
        </div>
      </div>
    </>
  )
}

// Import vendor components from dist paths
import { ConversationStarter } from '@openuidev/react-ui/dist/components/AgentInterface/ConversationStarter'

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
        <AgentInterface.Welcome
          glowAnimation
          className="openui-agent-welcome-screen--with-composer"
        >
          <OpenUIWelcome />
        </AgentInterface.Welcome>
        {isGuest ? <SaveMessages /> : <SaveDatabaseMessages />}
        <FollowStreamTail />
      </AgentInterface>
    </div>
  )
}
