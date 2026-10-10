import { tool } from 'ai'
import { getBrowserForUser } from './browser-adapter'
import { getSandboxForUser } from './sandbox-adapter'
import { checkPermissions, requiresApproval } from './security'
import {
  createApprovalRequest,
  getComputerStatus,
  recordAudit,
  updateBrowserState,
  updateTerminalState
} from './store'
import { computerInputs } from './types'

export function buildComputerTools(userId: string) {
  const browser = getBrowserForUser(userId)

  return {
    computer_navigate: tool({
      description: 'Naviguer vers une URL dans le navigateur réel de la machine isolée. Renvoie le titre, la nouvelle URL et une capture d’écran.',
      inputSchema: computerInputs.navigate,
      execute: async ({ url }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) {
          recordAudit(userId, 'navigate', 'agent', 'denied', perm.error)
          return { error: perm.error }
        }

        try {
          const res = await browser.navigate(url)
          updateBrowserState(userId, res.url, res.title, res.screenshot)
          recordAudit(userId, 'navigate', 'agent', 'succeeded', `Navigation vers ${url}`)
          return {
            success: true,
            url: res.url,
            title: res.title,
            screenshot: res.screenshot,
            message: `Navigué avec succès vers ${res.title || res.url}`
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec de navigation'
          recordAudit(userId, 'navigate', 'agent', 'failed', message)
          return { error: message }
        }
      }
    }),

    computer_read: tool({
      description: 'Lire le contenu texte et la structure lisible de la page web actuellement ouverte.',
      inputSchema: computerInputs.read,
      execute: async ({ maxLength }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const res = await browser.read(maxLength)
          recordAudit(userId, 'read', 'agent', 'succeeded', `Lecture de ${res.url}`)
          return {
            url: res.url,
            title: res.title,
            text: res.text
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec de lecture de page'
          return { error: message }
        }
      }
    }),

    computer_snapshot: tool({
      description:
        'Prendre un instantané complet de la page avec la liste des éléments interactifs étiquetés (boutons, liens, champs) avec leurs identifiants de référence (ex: "el-1"). Indispensable avant de cliquer ou taper.',
      inputSchema: computerInputs.snapshot,
      execute: async ({ includeScreenshot }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const snapshot = await browser.snapshot(includeScreenshot)
          updateBrowserState(userId, snapshot.url, snapshot.title, snapshot.screenshot)
          recordAudit(userId, 'snapshot', 'agent', 'succeeded', `Instantané (#${snapshot.snapshotId}) sur ${snapshot.url}`)
          return {
            snapshotId: snapshot.snapshotId,
            url: snapshot.url,
            title: snapshot.title,
            interactiveElementsCount: snapshot.elements.length,
            elements: snapshot.elements,
            summary: snapshot.textSummary,
            screenshot: snapshot.screenshot
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec de snapshot'
          return { error: message }
        }
      }
    }),

    computer_click: tool({
      description: 'Cliquer sur un élément interactif de la page en utilisant son identifiant de référence extrait du snapshot (ex: "el-3").',
      inputSchema: computerInputs.click,
      execute: async ({ ref }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const res = await browser.click(ref)
          updateBrowserState(userId, res.url, res.title, res.screenshot)
          recordAudit(userId, 'click', 'agent', 'succeeded', `Clic sur ${ref}`)
          return {
            success: true,
            url: res.url,
            title: res.title,
            screenshot: res.screenshot,
            message: `Élément ${ref} cliqué avec succès.`
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec du clic'
          recordAudit(userId, 'click', 'agent', 'failed', message)
          return { error: message }
        }
      }
    }),

    computer_type: tool({
      description: 'Saisir du texte dans un champ de formulaire repéré par son identifiant de référence (ex: "el-2").',
      inputSchema: computerInputs.type,
      execute: async ({ ref, text, submit }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const res = await browser.type(ref, text, submit)
          updateBrowserState(userId, res.url, res.title, res.screenshot)
          recordAudit(userId, 'type', 'agent', 'succeeded', `Saisie dans ${ref}: "${text.slice(0, 30)}"`)
          return {
            success: true,
            url: res.url,
            title: res.title,
            screenshot: res.screenshot,
            message: `Texte saisi dans ${ref}.`
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec de saisie'
          recordAudit(userId, 'type', 'agent', 'failed', message)
          return { error: message }
        }
      }
    }),

    computer_key: tool({
      description: 'Appuyer sur une touche du clavier (ex: "Enter", "Tab", "Escape", "ArrowDown").',
      inputSchema: computerInputs.key,
      execute: async ({ key }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const res = await browser.pressKey(key)
          updateBrowserState(userId, res.url, res.title, res.screenshot)
          recordAudit(userId, 'key', 'agent', 'succeeded', `Touche ${key}`)
          return {
            success: true,
            url: res.url,
            title: res.title,
            screenshot: res.screenshot
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec de la touche' }
        }
      }
    }),

    computer_scroll: tool({
      description: 'Faire défiler la page web verticalement (pixels positifs vers le bas, négatifs vers le haut).',
      inputSchema: computerInputs.scroll,
      execute: async ({ deltaY }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const res = await browser.scroll(deltaY)
          updateBrowserState(userId, res.url, res.title, res.screenshot)
          return {
            success: true,
            url: res.url,
            title: res.title,
            screenshot: res.screenshot
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec du défilement' }
        }
      }
    }),

    computer_screenshot: tool({
      description: 'Prendre une capture d’écran haute résolution de la page web actuelle.',
      inputSchema: computerInputs.screenshot,
      execute: async ({ fullPage }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return { error: perm.error }

        try {
          const screenshot = await browser.takeScreenshot(fullPage)
          const readInfo = await browser.read(100)
          updateBrowserState(userId, readInfo.url, readInfo.title, screenshot)
          recordAudit(userId, 'screenshot', 'agent', 'succeeded', 'Capture d’écran effectuée')
          return {
            screenshot,
            url: readInfo.url,
            title: readInfo.title
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec de capture' }
        }
      }
    }),

    computer_files_list: tool({
      description: 'Lister les fichiers et dossiers dans le workspace de travail de la machine isolée.',
      inputSchema: computerInputs.files_list,
      execute: async ({ path }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return { error: perm.error }

        try {
          const sandbox = await getSandboxForUser(userId)
          const files = await sandbox.listFiles(path)
          recordAudit(userId, 'files_list', 'agent', 'succeeded', `Liste des fichiers dans "${path || '.'}"`)
          return {
            path: path || '.',
            count: files.length,
            files
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec de listing des fichiers' }
        }
      }
    }),

    computer_files_read: tool({
      description: 'Lire le contenu d’un fichier texte dans le workspace de la machine isolée.',
      inputSchema: computerInputs.files_read,
      execute: async ({ path }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return { error: perm.error }

        try {
          const sandbox = await getSandboxForUser(userId)
          const contents = await sandbox.readFile(path)
          recordAudit(userId, 'files_read', 'agent', 'succeeded', `Lecture du fichier "${path}"`)
          return {
            path,
            contents,
            length: contents.length
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec de lecture de fichier' }
        }
      }
    }),

    computer_files_write: tool({
      description: 'Écrire ou modifier un fichier dans le workspace de la machine isolée.',
      inputSchema: computerInputs.files_write,
      execute: async ({ path, contents, append }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return { error: perm.error }

        if (requiresApproval('files_write', { path, contents, append })) {
          const appReq = createApprovalRequest(
            userId,
            'files_write',
            'computer_files_write',
            { path, length: contents.length, append },
            `Écriture volumineuse (${contents.length} caractères) dans le fichier "${path}"`
          )
          return {
            approvalRequired: true,
            approvalId: appReq.id,
            message: `Cette opération d'écriture requiert votre confirmation : ${appReq.reason}`
          }
        }

        try {
          const sandbox = await getSandboxForUser(userId)
          await sandbox.writeFile(path, contents, append)
          recordAudit(userId, 'files_write', 'agent', 'succeeded', `Écriture dans "${path}" (${contents.length} octets)`)
          return {
            success: true,
            path,
            bytesWritten: contents.length,
            message: `Fichier "${path}" sauvegardé avec succès.`
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Échec d’écriture de fichier' }
        }
      }
    }),

    computer_exec: tool({
      description:
        'Exécuter une commande shell autorisée dans l’environnement isolé de la machine (ex: "npm test", "git status", "ls -la", "node script.js"). Retourne stdout, stderr et le code de sortie.',
      inputSchema: computerInputs.exec,
      execute: async ({ command, timeoutMs }) => {
        const status = getComputerStatus(userId)
        const perm = checkPermissions(status.permissions, 'shell')
        if (!perm.allowed) return { error: perm.error }

        if (requiresApproval('exec', { command })) {
          const appReq = createApprovalRequest(
            userId,
            'exec',
            'computer_exec',
            { command },
            `Exécution de la commande shell : \`${command}\``
          )
          return {
            approvalRequired: true,
            approvalId: appReq.id,
            command,
            message: `L'exécution de la commande shell \`${command}\` nécessite votre approbation de sécurité.`
          }
        }

        try {
          const sandbox = await getSandboxForUser(userId)
          const result = await sandbox.runCommand(command, timeoutMs)
          updateTerminalState(userId, result.stdout || result.stderr, result.exitCode)
          recordAudit(
            userId,
            'exec',
            'agent',
            result.exitCode === 0 ? 'succeeded' : 'failed',
            `\`${command}\` (code ${result.exitCode}, ${result.durationMs}ms)`
          )
          return {
            command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Échec d’exécution'
          recordAudit(userId, 'exec', 'agent', 'failed', message)
          return { error: message, command, exitCode: 1 }
        }
      }
    })
  }
}
