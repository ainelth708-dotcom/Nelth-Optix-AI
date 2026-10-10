'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  MessageSquare,
  Clock3,
  BookOpen,
  Settings2,
  Plus,
  Monitor,
  Phone,
  ArrowUp,
  Globe,
  Camera,
  FolderTree,
  Terminal,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Square
} from 'lucide-react'
import type { ComputerStatus } from '@/lib/computer/types'
import './opendots.css'

interface Screen {
  base64: string
  width: number
  height: number
  url: string
  capturedAt: number
}

const OPENDOTS_SUGGESTIONS = [
  {
    title: 'Explorer un site web',
    desc: 'Ouvre wikipedia.org, inspecte la page et résume les articles du jour',
    prompt: 'Ouvre wikipedia.org, prends un instantané et donne-moi les articles en vedette'
  },
  {
    title: 'Exécuter un script',
    desc: 'Crée un fichier fibonacci.js dans le workspace et lance-le avec Node.js',
    prompt: 'Crée un fichier fibonacci.js qui calcule les 15 premiers termes et lance-le avec node'
  },
  {
    title: 'Capture visuelle',
    desc: 'Navigue vers news.ycombinator.com et capture la une',
    prompt: 'Navigue sur news.ycombinator.com, capture l’écran et résume les 3 premiers sujets'
  },
  {
    title: 'Fichiers du projet',
    desc: 'Liste les fichiers dans le workspace et lis les informations système',
    prompt: 'Liste tous les fichiers du workspace et vérifie la version de node disponible'
  }
]

type LoosePart = {
  type: string
  text?: string
  toolName?: string
  state?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
}

const TOOL_LABELS: Record<string, string> = {
  computer_navigate: 'Opening website',
  computer_snapshot: 'Inspecting browser',
  computer_read: 'Reading page',
  computer_screenshot: 'Viewing browser',
  computer_click: 'Clicking in browser',
  computer_type: 'Typing in browser',
  computer_key: 'Using keyboard',
  computer_scroll: 'Scrolling page',
  computer_files_write: 'Saving file',
  computer_files_read: 'Reading file',
  computer_files_list: 'Listing files',
  computer_exec: 'Running terminal command'
}

function OpenDotsToolCard({ part }: { part: LoosePart }) {
  const name =
    part.type === 'dynamic-tool'
      ? (part.toolName ?? 'tool')
      : part.type.replace(/^tool-/, '')

  const label = TOOL_LABELS[name] || name
  const running =
    part.state === 'input-streaming' || part.state === 'input-available'
  const failed = part.state === 'output-error'
  const input = part.input || {}
  const output = part.output || {}

  let detail: string | null = null
  if (typeof input.url === 'string') detail = input.url
  else if (typeof input.command === 'string') detail = `$ ${input.command}`
  else if (typeof input.path === 'string') detail = input.path
  else if (typeof input.ref === 'string') detail = `element ${input.ref}`

  return (
    <div className={`tool-card ${running ? 'tool-card-running' : ''}`}>
      <Monitor size={14} className="shrink-0 text-muted-foreground" />
      <span className="font-medium text-xs">{label}</span>
      {detail && <span className="tool-card-detail">« {detail} »</span>}
      {failed ? (
        <span className="text-[11px] text-rose-500 font-medium shrink-0">échec</span>
      ) : running ? (
        <span className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 shrink-0">
          <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" /> en cours…
        </span>
      ) : (
        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
      )}
    </div>
  )
}

function AssistantMessage({
  message,
  streaming
}: {
  message: UIMessage
  streaming: boolean
}) {
  const parts = (message.parts ?? []) as LoosePart[]
  return (
    <div className="flex w-full flex-col gap-2">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div key={index} className="whitespace-pre-wrap">
              {part.text}
              {streaming && index === parts.length - 1 && (
                <span className="ml-1 inline-block size-2 animate-pulse bg-foreground" />
              )}
            </div>
          )
        }
        if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
          return <OpenDotsToolCard key={index} part={part} />
        }
        return null
      })}
    </div>
  )
}

export function OpenDotsAgent() {
  const [activeRail, setActiveRail] = useState<'chat' | 'tasks' | 'pages' | 'settings'>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showComputer, setShowComputer] = useState(true)
  const [selectedThreadId, setSelectedThreadId] = useState('main-thread')

  // Computer Panel State
  const [computerTab, setComputerTab] = useState<'Browser' | 'Files' | 'Terminal' | 'Activity'>('Browser')
  const [computerStatus, setComputerStatus] = useState<ComputerStatus | null>(null)
  const [screen, setScreen] = useState<Screen | null>(null)
  const [screenError, setScreenError] = useState('')
  const [computerBusy, setComputerBusy] = useState(false)
  const [browserUrl, setBrowserUrl] = useState('')
  const [humanControl, setHumanControl] = useState(false)
  const [filePath, setFilePath] = useState('')
  const [fileContents, setFileContents] = useState('')
  const [terminalCommand, setTerminalCommand] = useState('')
  const [terminalOutput, setTerminalOutput] = useState('')

  // Chat State
  const [input, setInput] = useState('')
  const { messages, status, error, sendMessage, stop, setMessages, regenerate } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/agent/chat' })
    })

  const isBusy = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  // Refresh Computer Status & Screen
  const refreshComputer = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/computer/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.status) {
        setComputerStatus(data.status)
        if (data.status.lastScreenshot) {
          const rawBase64 = data.status.lastScreenshot.replace(/^data:image\/[a-z]+;base64,/, '')
          setScreen({
            base64: rawBase64,
            width: 1280,
            height: 800,
            url: data.status.currentUrl || '',
            capturedAt: Date.now()
          })
          if (!browserUrl && data.status.currentUrl) {
            setBrowserUrl(data.status.currentUrl)
          }
        }
      }
    } catch {
      // ignore polling errors
    }
  }, [browserUrl])

  useEffect(() => {
    void refreshComputer()
    const timer = setInterval(() => {
      void refreshComputer()
    }, 4000)
    return () => clearInterval(timer)
  }, [refreshComputer])

  // Run Computer Action
  const runAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (computerBusy) return
    setComputerBusy(true)
    try {
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      })
      const data = await res.json()
      if (action === 'exec') {
        setTerminalOutput(data.stdout || data.stderr || 'No output.')
      } else if (action === 'files_read') {
        setFileContents(data.contents || data.text || '')
      } else if (action === 'files_list') {
        setTerminalOutput(JSON.stringify(data.files || data, null, 2))
      }
      void refreshComputer()
      return data
    } catch (err) {
      console.error('Computer action failed:', err)
    } finally {
      setComputerBusy(false)
    }
  }

  // Toggle Permissions
  const togglePermission = async (key: 'enabled' | 'browser' | 'files' | 'shell') => {
    if (!computerStatus) return
    const nextVal = !computerStatus.permissions[key]
    try {
      await fetch('/api/agent/computer/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal })
      })
      void refreshComputer()
    } catch (err) {
      console.error('Permission toggle failed:', err)
    }
  }

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setInput('')
    void sendMessage({ text: trimmed })
  }

  const handleScreenClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!humanControl || !screen) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(
      screen.width - 1,
      Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * screen.width))
    )
    const y = Math.min(
      screen.height - 1,
      Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * screen.height))
    )
    void runAction('human_click', { x, y })
  }

  return (
    <div className="opendots-root">
      {/* 1. LEFT ICON RAIL */}
      <div className="opendots-rail">
        <div
          className="rail-brand"
          title="OpenDots"
          onClick={() => setSidebarOpen(prev => !prev)}
        >
          <span>•</span>•
        </div>

        <button
          type="button"
          className={activeRail === 'chat' ? 'active' : ''}
          onClick={() => setActiveRail('chat')}
          title="Conversations"
        >
          <MessageSquare size={17} />
        </button>

        <button
          type="button"
          className={activeRail === 'tasks' ? 'active' : ''}
          onClick={() => setActiveRail('tasks')}
          title="Tâches planifiées"
        >
          <Clock3 size={17} />
        </button>

        <button
          type="button"
          className={activeRail === 'pages' ? 'active' : ''}
          onClick={() => setActiveRail('pages')}
          title="Pages & Mémoires"
        >
          <BookOpen size={17} />
        </button>

        <button
          type="button"
          className="rail-settings"
          onClick={() => setActiveRail('settings')}
          title="Paramètres de l'agent"
        >
          <Settings2 size={17} />
        </button>
      </div>

      {/* 2. SECONDARY SIDEBAR */}
      <div className={`opendots-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-dot-badge">
            <div className="sidebar-dot-icon">●</div>
            <span>Generalist Dot</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMessages([])}
          className="new-chat-btn"
        >
          <Plus size={14} />
          <span>Nouvelle conversation</span>
        </button>

        <div className="sidebar-section-title">Conversations</div>
        <div className="threads-list">
          <div
            className={`thread-item ${selectedThreadId === 'main-thread' ? 'active' : ''}`}
            onClick={() => setSelectedThreadId('main-thread')}
          >
            <span className="truncate">Session principale</span>
          </div>
          <div
            className={`thread-item ${selectedThreadId === 'task-thread' ? 'active' : ''}`}
            onClick={() => setSelectedThreadId('task-thread')}
          >
            <span className="truncate">Automatisation web & scripts</span>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="opendots-workspace">
        {/* Topbar */}
        <div className="opendots-topbar">
          <div className="topbar-breadcrumbs">
            <span>Dot : Generalist</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground font-normal">
              {isEmpty ? 'Nouvel échange' : 'Session active'}
            </span>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-btn"
              title="Assistant vocal"
              onClick={() => alert('Mode vocal disponible dans Nelth-Voice.')}
            >
              <Phone size={13} />
              <span className="hidden sm:inline">Vocal</span>
            </button>

            <button
              type="button"
              className={`topbar-btn ${showComputer ? 'active' : ''}`}
              onClick={() => setShowComputer(prev => !prev)}
              title="Afficher/Masquer la machine"
            >
              <Monitor size={13} />
              <span>Machine</span>
              <span
                className={`size-1.5 rounded-full ${
                  computerStatus?.state === 'running' ? 'bg-emerald-500' : 'bg-zinc-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Canvas Split: Chat + ComputerPanel */}
        <div className="canvas-split">
          {/* Chat Pane */}
          <div className="chat-pane">
            <div className="messages-scroll">
              {isEmpty ? (
                <div className="opendots-empty-prompt">
                  <h2>Que souhaitez-vous exécuter ?</h2>
                  <p>
                    Ce Dot dispose d’un ordinateur isolé avec un vrai navigateur Chromium
                    et un espace de fichiers sandboxé (sans conteneur Docker requis).
                  </p>

                  <div className="suggestions-grid">
                    {OPENDOTS_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => submit(item.prompt)}
                        className="suggestion-card"
                      >
                        <div className="suggestion-card-title">
                          <Sparkles size={13} className="text-indigo-500" />
                          <span>{item.title}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px] leading-relaxed">
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(m => (
                  <div
                    key={m.id}
                    className={`chat-msg ${m.role === 'user' ? 'user' : 'assistant'}`}
                  >
                    {m.role === 'user' ? (
                      <div>
                        {(m.parts ?? [])
                          .filter(p => p.type === 'text')
                          .map(p => (p as { text: string }).text)
                          .join('')}
                      </div>
                    ) : (
                      <AssistantMessage
                        message={m}
                        streaming={isBusy && messages[messages.length - 1]?.id === m.id}
                      />
                    )}
                  </div>
                ))
              )}

              {error && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 flex items-center justify-between">
                  <span>Une erreur s’est produite lors de l’exécution.</span>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="underline font-medium"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="opendots-composer">
              <form
                onSubmit={e => {
                  e.preventDefault()
                  submit(input)
                }}
                className="composer-box"
              >
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      submit(input)
                    }
                  }}
                  placeholder="Donnez une consigne au Dot (ex: Va sur github, crée un fichier)..."
                  rows={1}
                />
                {isBusy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="send-btn bg-rose-600 text-white"
                    title="Arrêter"
                  >
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="send-btn"
                    title="Envoyer"
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* 4. EXACT OPENDOTS COMPUTER PANEL */}
          {showComputer && (
            <div className="result-pane">
              <section className="computer-panel">
                {/* Status Bar */}
                <div className="computer-status">
                  <strong>{computerStatus?.state || 'stopped'}</strong>
                  {computerStatus?.state !== 'running' && (
                    <button
                      type="button"
                      disabled={computerBusy}
                      onClick={() => void refreshComputer()}
                    >
                      Refresh
                    </button>
                  )}
                  <span>
                    {computerBusy
                      ? 'Working…'
                      : humanControl
                        ? 'You have control'
                        : 'Dot control'}
                  </span>
                </div>

                {/* Tabs */}
                <div className="computer-tool-tabs" role="tablist">
                  {(['Browser', 'Files', 'Terminal', 'Activity'] as const).map(name => (
                    <button
                      key={name}
                      role="tab"
                      aria-selected={computerTab === name}
                      onClick={() => setComputerTab(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {/* TAB: BROWSER */}
                {computerTab === 'Browser' && (
                  <div className="computer-section">
                    {!computerStatus?.permissions?.browser && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Activez la permission Navigateur dans les réglages ci-dessous.
                      </p>
                    )}

                    <form
                      className="computer-row"
                      onSubmit={e => {
                        e.preventDefault()
                        if (browserUrl.trim()) {
                          void runAction('navigate', { url: browserUrl.trim() })
                        }
                      }}
                    >
                      <input
                        type="text"
                        placeholder="https://example.com"
                        value={browserUrl}
                        onChange={e => setBrowserUrl(e.target.value)}
                        disabled={computerBusy}
                      />
                      <button type="submit" disabled={computerBusy || !browserUrl.trim()}>
                        Aller
                      </button>
                    </form>

                    {screen ? (
                      <>
                        <div className="computer-current-url" title={screen.url}>
                          {screen.url || 'Browser screen'}
                        </div>
                        <button
                          type="button"
                          className="computer-screen"
                          disabled={!humanControl || computerBusy}
                          onClick={handleScreenClick}
                          title={
                            humanControl
                              ? 'Cliquez pour interagir directement sur la page'
                              : 'Prenez le contrôle pour cliquer'
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/jpeg;base64,${screen.base64}`}
                            alt="Live Chromium browser screen"
                          />
                        </button>
                        <small className="block mt-1 text-[11px] text-muted-foreground">
                          Capturé à {new Date(screen.capturedAt).toLocaleTimeString()}.
                        </small>
                      </>
                    ) : (
                      <div className="computer-screen-empty">
                        {computerStatus?.permissions?.browser
                          ? 'En attente d’une page ouverte dans le navigateur Chromium…'
                          : 'Démarrez l’ordinateur avec la permission Navigateur.'}
                      </div>
                    )}

                    <div className="computer-control-pill">
                      <span>{humanControl ? 'Vous avez le contrôle' : 'Le Dot a le contrôle'}</span>
                      <button
                        type="button"
                        onClick={() => setHumanControl(prev => !prev)}
                        disabled={computerBusy}
                      >
                        {humanControl ? 'Rendre le contrôle' : 'Prendre le contrôle'}
                      </button>
                    </div>

                    {humanControl && (
                      <details className="mt-2 text-xs">
                        <summary className="font-semibold cursor-pointer py-1">
                          Contrôles clavier & défilement
                        </summary>
                        <div className="computer-actions mt-2">
                          <button
                            type="button"
                            onClick={() => void runAction('human_scroll', { deltaY: -400 })}
                          >
                            Défiler vers le haut
                          </button>
                          <button
                            type="button"
                            onClick={() => void runAction('human_scroll', { deltaY: 400 })}
                          >
                            Défiler vers le bas
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* TAB: FILES */}
                {computerTab === 'Files' && (
                  <div className="computer-section">
                    <p className="text-xs text-muted-foreground">
                      Chemins relatifs au workspace isolé du Dot.
                    </p>
                    <div className="computer-row">
                      <input
                        type="text"
                        placeholder="notes.txt ou mon-projet"
                        value={filePath}
                        onChange={e => setFilePath(e.target.value)}
                        disabled={computerBusy}
                      />
                    </div>
                    <div className="computer-actions">
                      <button
                        type="button"
                        onClick={() => void runAction('files_list', { path: filePath })}
                        disabled={computerBusy}
                      >
                        Lister les fichiers
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction('files_read', { path: filePath })}
                        disabled={computerBusy || !filePath.trim()}
                      >
                        Lire le fichier
                      </button>
                    </div>

                    <label className="block mt-3 text-xs font-semibold">Contenu du fichier</label>
                    <textarea
                      value={fileContents}
                      onChange={e => setFileContents(e.target.value)}
                      rows={5}
                      className="w-full mt-1 font-mono text-xs p-2 border border-border rounded"
                      placeholder="Tapez le contenu à sauvegarder..."
                    />
                    <div className="computer-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void runAction('files_write', { path: filePath, contents: fileContents })
                        }
                        disabled={computerBusy || !filePath.trim()}
                      >
                        Sauvegarder le fichier
                      </button>
                    </div>

                    {terminalOutput && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold mb-1">Sortie</h4>
                        <pre tabIndex={0}>{terminalOutput}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: TERMINAL */}
                {computerTab === 'Terminal' && (
                  <div className="computer-section">
                    <p className="text-xs text-muted-foreground">
                      Exécution dans le sandbox isolé (Vercel/Local). Timeout 30s.
                    </p>
                    <form
                      onSubmit={e => {
                        e.preventDefault()
                        if (terminalCommand.trim()) {
                          void runAction('exec', { command: terminalCommand.trim() })
                        }
                      }}
                    >
                      <textarea
                        value={terminalCommand}
                        onChange={e => setTerminalCommand(e.target.value)}
                        placeholder="node -v, ls -la, npm test..."
                        rows={3}
                        className="w-full font-mono text-xs p-2 border border-border rounded"
                      />
                      <div className="computer-actions">
                        <button type="submit" disabled={computerBusy || !terminalCommand.trim()}>
                          Exécuter la commande
                        </button>
                      </div>
                    </form>

                    {terminalOutput && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-semibold">Sortie de la console</h4>
                          <button
                            type="button"
                            onClick={() => setTerminalOutput('')}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            Effacer
                          </button>
                        </div>
                        <pre tabIndex={0}>{terminalOutput}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: ACTIVITY */}
                {computerTab === 'Activity' && (
                  <div className="computer-section">
                    <h4 className="text-xs font-semibold mb-2">Historique d’activité</h4>
                    {computerStatus?.audit && computerStatus.audit.length > 0 ? (
                      <ol className="computer-audit">
                        {computerStatus.audit
                          .slice(-25)
                          .reverse()
                          .map(entry => (
                            <li key={entry.id}>
                              <strong>{entry.action.replace(/_/g, ' ')}</strong>
                              <span>
                                {entry.actor} · {entry.outcome} ·{' '}
                                {new Date(entry.createdAt).toLocaleTimeString()}
                              </span>
                            </li>
                          ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune action récente.</p>
                    )}
                  </div>
                )}

                {/* SETTINGS / PERMISSIONS (BOTTOM DRAWER) */}
                <details className="computer-section mt-4 pt-3 border-t border-border">
                  <summary className="font-semibold cursor-pointer text-xs py-1">
                    Paramètres & Permissions de la machine
                  </summary>
                  <div className="computer-permissions text-xs py-2">
                    <p className="text-muted-foreground text-[11px] mb-2">
                      Définissez les droits d’accès accordés au Dot :
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={computerStatus?.permissions?.enabled ?? true}
                        onChange={() => togglePermission('enabled')}
                      />
                      <span>Activer l’ordinateur</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={computerStatus?.permissions?.browser ?? true}
                        onChange={() => togglePermission('browser')}
                      />
                      <span>Navigateur Chromium</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={computerStatus?.permissions?.files ?? true}
                        onChange={() => togglePermission('files')}
                      />
                      <span>Fichiers du Workspace</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={computerStatus?.permissions?.shell ?? true}
                        onChange={() => togglePermission('shell')}
                      />
                      <span>Commandes Terminal</span>
                    </label>

                    <div className="computer-actions mt-3">
                      <button
                        type="button"
                        onClick={() => void runAction('snapshot')}
                        disabled={computerBusy}
                      >
                        Prendre un instantané
                      </button>
                    </div>
                  </div>
                </details>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
