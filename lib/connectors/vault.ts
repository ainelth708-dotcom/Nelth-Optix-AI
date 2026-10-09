import { getPostgresDb } from '@/lib/db/postgres'
import { connectorTokens } from '@/lib/db/user-schema'
import { and, eq } from 'drizzle-orm'

import { decryptSecret, encryptSecret } from './crypto'
import { ConnectorAuthError, isGrantDeadError } from './errors'
import {
  type ConnectorProviderId,
  refreshAccessToken,
  type TokenResult
} from './providers'

/**
 * Encrypted per-user OAuth token vault (PostgreSQL).
 *
 * Table layout: `connector_tokens(user_id, provider)` — one row per grant.
 * Only sealed blobs are stored (AES-256-GCM, same crypto as before). Access
 * tokens are short-lived and re-minted on demand via `getValidAccessToken`
 * (refresh flow with a 60s skew), so a database read never leaks a usable
 * credential. Firebase Auth still owns identity: userId is always the
 * server-verified Firebase UID.
 */

export interface StoredConnection {
  provider: ConnectorProviderId
  refreshTokenSealed: string | null
  accessTokenSealed: string | null
  expiresAt: number | null
  scope?: string
  providerAccountId?: string
  providerAccountName?: string
  /** Set when the grant died (revoked/expired): UI shows Reconnect. */
  authFailedAt?: number | null
  updatedAt: number
}

const REFRESH_SKEW_MS = 60 * 1000

function toRow(
  userId: string,
  provider: ConnectorProviderId,
  conn: StoredConnection
) {
  return {
    userId,
    provider,
    refreshTokenSealed: conn.refreshTokenSealed,
    accessTokenSealed: conn.accessTokenSealed,
    expiresAt: conn.expiresAt,
    scope: conn.scope ?? null,
    providerAccountId: conn.providerAccountId ?? null,
    providerAccountName: conn.providerAccountName ?? null,
    authFailedAt: conn.authFailedAt ?? null,
    updatedAt: conn.updatedAt
  }
}

function toStored(
  provider: ConnectorProviderId,
  tokens: TokenResult
): StoredConnection {
  return {
    provider,
    refreshTokenSealed: tokens.refreshToken
      ? encryptSecret(tokens.refreshToken)
      : null,
    // Cached access token (sealed too). Refreshed transparently on read.
    accessTokenSealed: encryptSecret(tokens.accessToken),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    providerAccountId: tokens.providerAccountId,
    providerAccountName: tokens.providerAccountName,
    updatedAt: Date.now()
  }
}

export async function saveConnection(
  userId: string,
  provider: ConnectorProviderId,
  tokens: TokenResult
): Promise<void> {
  if (!userId) throw new Error('saveConnection requires a userId')
  const db = getPostgresDb()
  const stored = { ...toStored(provider, tokens), authFailedAt: null }
  await db
    .insert(connectorTokens)
    .values(toRow(userId, provider, stored))
    .onConflictDoUpdate({
      target: [connectorTokens.userId, connectorTokens.provider],
      set: {
        refreshTokenSealed: stored.refreshTokenSealed,
        accessTokenSealed: stored.accessTokenSealed,
        expiresAt: stored.expiresAt,
        scope: stored.scope ?? null,
        providerAccountId: stored.providerAccountId ?? null,
        providerAccountName: stored.providerAccountName ?? null,
        authFailedAt: null,
        updatedAt: stored.updatedAt
      }
    })
}

/** Records a dead grant so the UI can offer Reconnect instead of green. */
export async function markConnectorAuthFailure(
  userId: string,
  provider: ConnectorProviderId
): Promise<void> {
  if (!userId) return
  await getPostgresDb()
    .insert(connectorTokens)
    .values({
      userId,
      provider,
      refreshTokenSealed: null,
      accessTokenSealed: null,
      expiresAt: null,
      scope: null,
      providerAccountId: null,
      providerAccountName: null,
      authFailedAt: Date.now(),
      updatedAt: Date.now()
    })
    .onConflictDoUpdate({
      target: [connectorTokens.userId, connectorTokens.provider],
      set: { authFailedAt: Date.now(), updatedAt: Date.now() }
    })
    .catch(() => {})
}

/** True when the stored grant is known-dead (needsReconnect UI state). */
export async function connectionNeedsReconnect(
  userId: string,
  provider: ConnectorProviderId
): Promise<boolean> {
  const conn = await getConnection(userId, provider).catch(() => null)
  return Boolean(conn?.authFailedAt)
}

export async function getConnection(
  userId: string,
  provider: ConnectorProviderId
): Promise<StoredConnection | null> {
  if (!userId) return null
  const rows = await getPostgresDb()
    .select()
    .from(connectorTokens)
    .where(
      and(
        eq(connectorTokens.userId, userId),
        eq(connectorTokens.provider, provider)
      )
    )
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    provider,
    refreshTokenSealed: row.refreshTokenSealed,
    accessTokenSealed: row.accessTokenSealed,
    expiresAt: row.expiresAt,
    scope: row.scope ?? undefined,
    providerAccountId: row.providerAccountId ?? undefined,
    providerAccountName: row.providerAccountName ?? undefined,
    authFailedAt: row.authFailedAt ?? undefined,
    updatedAt: row.updatedAt
  } as StoredConnection
}

export async function deleteConnection(
  userId: string,
  provider: ConnectorProviderId
): Promise<void> {
  if (!userId) return
  await getPostgresDb()
    .delete(connectorTokens)
    .where(
      and(
        eq(connectorTokens.userId, userId),
        eq(connectorTokens.provider, provider)
      )
    )
    .catch(() => {})
}

/** True when the user has stored (refreshable or permanent) credentials. */
export async function hasConnection(
  userId: string,
  provider: ConnectorProviderId
): Promise<boolean> {
  const conn = await getConnection(userId, provider)
  if (!conn) return false
  // Permanent tokens (GitHub classic, Notion) have no refresh token.
  if (!conn.refreshTokenSealed) return !!conn.accessTokenSealed
  return true
}

/**
 * Returns a usable access token, refreshing it first when expired.
 * Throws ConnectorAuthError when no connection exists or the grant died
 * (caller surfaces a "reconnect" state — never token material).
 */
export async function getValidAccessToken(
  userId: string,
  provider: ConnectorProviderId
): Promise<string> {
  const conn = await getConnection(userId, provider)
  if (!conn?.accessTokenSealed) {
    throw new ConnectorAuthError(provider)
  }
  const fresh = !conn.expiresAt || conn.expiresAt - Date.now() > REFRESH_SKEW_MS
  if (fresh) {
    if (conn.authFailedAt) {
      // A previous call proved the grant dead — don't serve the token.
      throw new ConnectorAuthError(provider)
    }
    return decryptSecret(conn.accessTokenSealed)
  }
  if (!conn.refreshTokenSealed) {
    // Permanent token past its (unknown) lifetime — return it once and let
    // the API call itself decide; do not delete on suspicion.
    return decryptSecret(conn.accessTokenSealed)
  }
  let refreshed: Awaited<ReturnType<typeof refreshAccessToken>>
  try {
    refreshed = await refreshAccessToken({
      provider,
      refreshToken: decryptSecret(conn.refreshTokenSealed)
    })
  } catch (error) {
    if (isGrantDeadError(error)) {
      await markConnectorAuthFailure(userId, provider)
      throw new ConnectorAuthError(provider)
    }
    throw error
  }
  await getPostgresDb()
    .insert(connectorTokens)
    .values({
      userId,
      provider,
      refreshTokenSealed: refreshed.refreshToken
        ? encryptSecret(refreshed.refreshToken)
        : null,
      accessTokenSealed: encryptSecret(refreshed.accessToken),
      expiresAt: refreshed.expiresAt,
      scope: null,
      providerAccountId: null,
      providerAccountName: null,
      authFailedAt: null,
      updatedAt: Date.now()
    })
    .onConflictDoUpdate({
      target: [connectorTokens.userId, connectorTokens.provider],
      set: {
        // Persist a rotated refresh token (GitHub Apps rotate on refresh);
        // without this the next refresh uses a dead token.
        ...(refreshed.refreshToken
          ? { refreshTokenSealed: encryptSecret(refreshed.refreshToken) }
          : {}),
        accessTokenSealed: encryptSecret(refreshed.accessToken),
        expiresAt: refreshed.expiresAt,
        authFailedAt: null,
        updatedAt: Date.now()
      }
    })
  return refreshed.accessToken
}
