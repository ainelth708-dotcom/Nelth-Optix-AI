'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Terminal as TerminalIcon,
  FolderTree,
  Shield,
  RefreshCw,
  ArrowRight,
  Camera,
  Check,
  X,
  Play,
  FileText,
  Folder,
  AlertTriangle,
  Lock,
  Unlock,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ComputerStatus,
  ComputerApprovalRequest,
  ComputerAudit
} from '@/lib/computer/types'
import type { WorkspaceFileEntry } from '@/lib/computer/sandbox-adapter'

type ActiveTab = 'browser' | 'files' | 'terminal' | 'activity'

interface ComputerPanelProps {
  className?: string
  onApprovalCountChange?: (count: number) => void
}

export function ComputerPanel({ className, onApprovalCountChange }: ComputerPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('browser')
  const [status, setStatus] = useState<ComputerStatus | null>(null)
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Browser state
  const [urlInput, setUrlInput] = useState('')
  const [zoomScreenshot, setZoomScreenshot] = useState(false)

  // Terminal state
  const [commandInput, setCommandInput] = useState('')
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{ command: string; output: string; exitCode: number; time: string }>
  >([])

  // Refresh status & files
  const refreshStatus = useCallback(async (path = currentPath) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agent/computer/status?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Status fetch failed')
      const data = await res.json()
      if (data.status) {
        setStatus(data.status)
        if (data.status.currentUrl && !urlInput) {
          setUrlInput(data.status.currentUrl)
        }
        if (onApprovalCountChange) {
          onApprovalCountChange(data.status.pendingApprovals?.length || 0)
        }
      }
      if (Array.isArray(data.files)) {
        setFiles(data.files)
      }
    } catch (err) {
      console.error('Failed to load computer status:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPath, urlInput, onApprovalCountChange])

  useEffect(() => {
    void refreshStatus()
    // Poll status periodically (every 5 seconds) to catch agent actions & live screenshots
    const interval = setInterval(() => {
      void refreshStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  // Permissions toggle
  const togglePermission = async (key: 'enabled' | 'browser' | 'files' | 'shell') => {
    if (!status) return
    const nextVal = !status.permissions[key]
    try {
      const res = await fetch('/api/agent/computer/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal })
      })
      if (res.ok) {
        void refreshStatus()
      }
    } catch (err) {
      console.error('Toggle permission error:', err)
    }
  }

  // Handle Approvals
  const handleApprove = async (approvalId: string, approved: boolean) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, approved })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.executionResult && data.executionResult.command) {
          setTerminalHistory(prev => [
            ...prev,
            {
              command: data.executionResult.command,
              output: data.executionResult.stdout || data.executionResult.stderr,
              exitCode: data.executionResult.exitCode,
              time: new Date().toLocaleTimeString()
            }
          ])
        }
        void refreshStatus()
      }
    } catch (err) {
      console.error('Approve error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Manual browser navigation
  const handleNavigate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    let url = urlInput.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`
      setUrlInput(url)
    }
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'navigate', url })
      })
      if (res.ok) {
        void refreshStatus()
      }
    } catch (err) {
      console.error('Navigate error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Manual screenshot
  const handleTakeScreenshot = async () => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot' })
      })
      if (res.ok) {
        void refreshStatus()
      }
    } catch (err) {
      console.error('Screenshot error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Manual snapshot
  const handleTakeSnapshot = async () => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' })
      })
      if (res.ok) {
        void refreshStatus()
      }
    } catch (err) {
      console.error('Snapshot error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Read file contents
  const handleReadFile = async (path: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'files_read', path })
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedFile({ path, content: data.contents || '' })
      }
    } catch (err) {
      console.error('Read file error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Run terminal command
  const handleRunCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cmd = commandInput.trim()
    if (!cmd) return
    setCommandInput('')
    try {
      setActionLoading(true)
      const res = await fetch('/api/agent/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exec', command: cmd })
      })
      const data = await res.json()
      setTerminalHistory(prev => [
        ...prev,
        {
          command: cmd,
          output: data.stdout || data.stderr || (data.error ? `Erreur: ${data.error}` : 'Aucune sortie.'),
          exitCode: typeof data.exitCode === 'number' ? data.exitCode : (data.error ? 1 : 0),
          time: new Date().toLocaleTimeString()
        }
      ])
      void refreshStatus()
    } catch (err) {
      setTerminalHistory(prev => [
        ...prev,
        {
          command: cmd,
          output: String(err),
          exitCode: 1,
          time: new Date().toLocaleTimeString()
        }
      ])
    } finally {
      setActionLoading(false)
    }
  }

  const pendingApprovalsCount = status?.pendingApprovals?.length || 0

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/5 dark:shadow-black/20',
        className
      )}
    >
      {/* Top Header / Status bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center size-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sm">
            <Sparkles size={16} />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
                status?.permissions?.enabled ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">Machine Virtuelle</span>
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider',
                  status?.permissions?.enabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                )}
              >
                {status?.permissions?.enabled ? 'Isolée (Vercel/Local)' : 'Désactivée'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Chromium headless • Sandbox Node.js/Bash</p>
          </div>
        </div>

        {/* Permissions & Refresh Action */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title={status?.permissions?.browser ? 'Navigateur actif' : 'Navigateur coupé'}
            onClick={() => togglePermission('browser')}
            className={cn(
              'px-2 py-1 text-xs rounded-lg font-medium flex items-center gap-1 transition-colors border',
              status?.permissions?.browser
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'bg-muted text-muted-foreground border-transparent opacity-60'
            )}
          >
            <Globe size={12} />
            <span className="hidden sm:inline">Web</span>
          </button>
          <button
            type="button"
            title={status?.permissions?.files ? 'Fichiers actifs' : 'Fichiers coupés'}
            onClick={() => togglePermission('files')}
            className={cn(
              'px-2 py-1 text-xs rounded-lg font-medium flex items-center gap-1 transition-colors border',
              status?.permissions?.files
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-muted text-muted-foreground border-transparent opacity-60'
            )}
          >
            <FolderTree size={12} />
            <span className="hidden sm:inline">Files</span>
          </button>
          <button
            type="button"
            title={status?.permissions?.shell ? 'Terminal actif' : 'Terminal coupé'}
            onClick={() => togglePermission('shell')}
            className={cn(
              'px-2 py-1 text-xs rounded-lg font-medium flex items-center gap-1 transition-colors border',
              status?.permissions?.shell
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                : 'bg-muted text-muted-foreground border-transparent opacity-60'
            )}
          >
            <TerminalIcon size={12} />
            <span className="hidden sm:inline">Shell</span>
          </button>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-3 pt-2 border-b border-border bg-muted/20 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('browser')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'browser'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe size={13} />
          Navigateur
          {status?.currentUrl && (
            <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'files'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderTree size={13} />
          Fichiers ({files.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'terminal'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <TerminalIcon size={13} />
          Terminal
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 -mb-px ml-auto',
            activeTab === 'activity'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Shield size={13} />
          Activité
          {pendingApprovalsCount > 0 && (
            <span className="flex items-center justify-center size-4 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-bounce">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>

      {/* Pending Approval Notice Banner (if any) */}
      {pendingApprovalsCount > 0 && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-600 dark:text-rose-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={15} className="shrink-0 text-rose-500 animate-pulse" />
            <span className="font-semibold shrink-0">Confirmation requise :</span>
            <span className="truncate">{status?.pendingApprovals[0].reason}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => handleApprove(status!.pendingApprovals[0].id, true)}
              disabled={actionLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium shadow-sm transition-colors"
            >
              <Check size={12} /> Approuver
            </button>
            <button
              type="button"
              onClick={() => handleApprove(status!.pendingApprovals[0].id, false)}
              disabled={actionLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium shadow-sm transition-colors"
            >
              <X size={12} /> Refuser
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto relative p-3">
        {/* TAB 1: BROWSER */}
        {activeTab === 'browser' && (
          <div className="flex flex-col h-full gap-3">
            {/* Address Bar */}
            <form onSubmit={handleNavigate} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-muted/60 border border-input rounded-xl px-3 py-1.5 text-xs text-foreground focus-within:ring-2 focus-within:ring-sky-500/30">
                <Globe size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading || !urlInput.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                <ArrowRight size={13} />
                <span>Aller</span>
              </button>
              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={actionLoading}
                title="Prendre un instantané DOM pour l'agent"
                className="p-2 rounded-xl border border-input hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={13} className={cn(actionLoading && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={handleTakeScreenshot}
                disabled={actionLoading}
                title="Capturer l'écran"
                className="p-2 rounded-xl border border-input hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Camera size={13} />
              </button>
            </form>

            {/* Browser Viewport */}
            <div className="flex-1 relative flex flex-col min-h-[300px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-inner">
              {/* Fake Chrome Titlebar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500/80 inline-block" />
                  <span className="size-2 rounded-full bg-amber-500/80 inline-block" />
                  <span className="size-2 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="ml-2 font-mono truncate max-w-[200px] text-zinc-300">
                    {status?.pageTitle || 'Nouvel onglet'}
                  </span>
                </div>
                {status?.lastScreenshot && (
                  <button
                    type="button"
                    onClick={() => setZoomScreenshot(prev => !prev)}
                    className="hover:text-zinc-200 transition-colors"
                    title="Agrandir"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
              </div>

              {/* Viewport content */}
              <div className="flex-1 flex items-center justify-center p-2 overflow-auto bg-zinc-900/40">
                {status?.lastScreenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={status.lastScreenshot}
                    alt="Capture d'écran du navigateur de la machine virtuelle"
                    className={cn(
                      'rounded border border-zinc-800/80 shadow-md object-contain transition-all',
                      zoomScreenshot ? 'max-w-none w-full' : 'max-h-[460px] w-auto'
                    )}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm text-zinc-400">
                    <div className="p-3 rounded-2xl bg-zinc-800/60 mb-3 text-sky-400">
                      <Globe size={28} />
                    </div>
                    <p className="text-xs font-medium text-zinc-300 mb-1">Aucune page ouverte</p>
                    <p className="text-[11px] text-zinc-500">
                      Entrez une URL ci-dessus ou demandez à l’agent dans le chat d’effectuer une recherche ou d’inspecter un site.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FILES */}
        {activeTab === 'files' && (
          <div className="flex flex-col h-full gap-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border">
              <span className="font-medium text-foreground">
                Dossier workspace : <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{currentPath || '.'}</code>
              </span>
              <button
                type="button"
                onClick={() => void refreshStatus(currentPath)}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} /> Actualiser
              </button>
            </div>

            {selectedFile ? (
              <div className="flex flex-col h-full bg-card rounded-xl border border-border p-3 gap-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-amber-500" />
                    <span className="text-xs font-mono font-medium text-foreground">{selectedFile.path}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Fermer
                  </button>
                </div>
                <pre className="flex-1 font-mono text-[11px] bg-muted/40 p-3 rounded-lg overflow-auto whitespace-pre leading-relaxed text-foreground/90">
                  {selectedFile.content || '(Fichier vide)'}
                </pre>
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <FolderTree size={32} className="mb-2 opacity-40 text-amber-500" />
                <p className="text-xs font-medium">Workspace vide</p>
                <p className="text-[11px] mt-1 text-muted-foreground/80">
                  Les fichiers créés par l’agent ou les commandes s’afficheront ici.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {files.map(file => (
                  <div
                    key={file.path}
                    onClick={() => {
                      if (file.isDirectory) {
                        setCurrentPath(file.path)
                        void refreshStatus(file.path)
                      } else {
                        void handleReadFile(file.path)
                      }
                    }}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:border-amber-500/30 hover:bg-muted/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {file.isDirectory ? (
                        <Folder size={15} className="text-amber-500 shrink-0" />
                      ) : (
                        <FileText size={15} className="text-sky-500 shrink-0" />
                      )}
                      <span className="font-mono text-foreground truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px] shrink-0 font-mono">
                      {file.size !== undefined && <span>{Math.round(file.size / 1024)} KB</span>}
                      <ChevronRight size={13} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TERMINAL */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col h-full gap-3">
            {/* Terminal console display */}
            <div className="flex-1 min-h-[280px] bg-zinc-950 text-zinc-100 rounded-xl p-3 font-mono text-xs overflow-y-auto border border-zinc-800 shadow-inner flex flex-col">
              <div className="text-zinc-500 text-[11px] mb-3 pb-2 border-b border-zinc-800 flex items-center justify-between">
                <span>nelth-agent@isolated-sandbox:~$</span>
                <span>Bash / Node.js</span>
              </div>

              {terminalHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-center text-xs">
                  <TerminalIcon size={24} className="mb-2 opacity-50 text-indigo-400" />
                  <p>Aucune commande exécutée dans cette session.</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Exécutez par exemple <code className="text-zinc-400">ls -la</code>, <code className="text-zinc-400">node -v</code>, ou <code className="text-zinc-400">npm test</code>.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {terminalHistory.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400">$</span>
                          <span className="text-zinc-200 font-semibold">{item.command}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600">{item.time}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[10px]',
                              item.exitCode === 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            )}
                          >
                            code {item.exitCode}
                          </span>
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap text-[11px] text-zinc-300 bg-zinc-900/60 p-2 rounded border border-zinc-800/80 leading-relaxed overflow-x-auto">
                        {item.output}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Command input prompt */}
            <form onSubmit={handleRunCommand} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus-within:ring-2 focus-within:ring-indigo-500/40">
                <span className="text-indigo-400 font-bold">$</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={e => setCommandInput(e.target.value)}
                  placeholder="Entrez une commande (ex: ls -la, node -v)..."
                  className="w-full bg-transparent outline-none placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading || !commandInput.trim()}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Play size={12} />
                <span>Exécuter</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: ACTIVITY & APPROVALS */}
        {activeTab === 'activity' && (
          <div className="flex flex-col h-full gap-4">
            {/* Approvals section */}
            {status?.pendingApprovals && status.pendingApprovals.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertTriangle size={13} />
                  Demandes d’approbation en attente ({status.pendingApprovals.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {status.pendingApprovals.map(req => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-foreground">{req.tool}</span>
                          <p className="text-muted-foreground text-[11px] mt-0.5">{req.reason}</p>
                        </div>
                        <span className="text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-full font-mono">
                          Sécurité
                        </span>
                      </div>
                      {Boolean(req.input.command) && (
                        <code className="text-[11px] font-mono bg-background/80 p-2 rounded border border-border text-foreground">
                          {String(req.input.command)}
                        </code>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => handleApprove(req.id, false)}
                          disabled={actionLoading}
                          className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted font-medium transition-colors"
                        >
                          Refuser
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(req.id, true)}
                          disabled={actionLoading}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 shadow-sm transition-colors"
                        >
                          Approuver et Exécuter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit log history */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={13} /> Journal d’audit de la machine
              </h3>
              {(!status?.audit || status.audit.length === 0) ? (
                <div className="text-center p-6 text-xs text-muted-foreground">
                  Aucun événement dans le journal d’audit.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {status.audit.slice().reverse().map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-card/40 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'size-2 rounded-full shrink-0',
                            item.outcome === 'succeeded' && 'bg-emerald-500',
                            item.outcome === 'failed' && 'bg-rose-500',
                            item.outcome === 'denied' && 'bg-amber-500',
                            item.outcome === 'pending' && 'bg-sky-500 animate-pulse'
                          )}
                        />
                        <span className="font-semibold text-foreground shrink-0">{item.action}</span>
                        {item.details && (
                          <span className="text-muted-foreground text-[11px] truncate font-mono">
                            {item.details}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                        <span className="capitalize">{item.actor}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
