import { ComputerPermissions } from './types'

// Block dangerous private network endpoints (SSRF prevention)
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.169\.254$/, // Cloud metadata IP
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i
]

export function isUrlAllowed(urlStr: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { allowed: false, reason: 'Seuls les protocoles http:// et https:// sont autorisés.' }
    }
    const hostname = parsed.hostname.toLowerCase()
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return { allowed: false, reason: 'Accès aux réseaux locaux ou métadonnées cloud bloqué pour des raisons de sécurité.' }
      }
    }
    return { allowed: true }
  } catch {
    return { allowed: false, reason: 'URL invalide.' }
  }
}

// Block destructive or dangerous shell patterns
const FORBIDDEN_SHELL_PATTERNS = [
  /rm\s+(-rf?|-fr?)\s+[/~]/i,
  /:()\{\s*:\|:&\s*\};:/, // fork bomb
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/(sda|null|zero|random)/i,
  /chmod\s+777\s+\//i,
  /chown\s+.*\/etc/i,
  /curl.*\|\s*(bash|sh)/i,
  /wget.*\|\s*(bash|sh)/i,
  /env\b.*grep.*KEY/i,
  /\/etc\/(shadow|passwd)/i
]

export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim()
  if (!trimmed) {
    return { allowed: false, reason: 'Commande vide.' }
  }
  for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: 'Commande potentiellement destructive ou dangereuse bloquée par la politique de sécurité.' }
    }
  }
  return { allowed: true }
}

export function requiresApproval(action: string, input: Record<string, unknown>): boolean {
  if (action === 'exec') return true
  if (action === 'files_write' && input.contents && (input.contents as string).length > 20000) return true
  return false
}

export function checkPermissions(
  permissions: ComputerPermissions,
  action: 'browser' | 'files' | 'shell'
): { allowed: boolean; error?: string } {
  if (!permissions.enabled) {
    return { allowed: false, error: "L'agent ordinateur est actuellement désactivé." }
  }
  if (!permissions[action]) {
    return { allowed: false, error: `La permission pour l'action '${action}' est désactivée par l'utilisateur.` }
  }
  return { allowed: true }
}
