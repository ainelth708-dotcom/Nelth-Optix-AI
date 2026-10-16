import { createChatWithFirstMessage } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { generateId } from '@/lib/db/schema'
import {
  MAX_BODY_BYTES,
  OPENUI_CHAT_PREFIX,
  parseMessage,
  type StoredMessage,
  titleFromMessage,
  toThread} from '@/lib/openui/persistence'

import { hasAllowedOrigin } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/same-origin'

function unauthorized() {
  return Response.json(
    { error: { message: 'Authentication required.' } },
    { status: 401 }
  )
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const cursor = new URL(request.url).searchParams.get('cursor')
  const offset = cursor ? Number.parseInt(cursor, 10) : 0
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return Response.json(
      { error: { message: 'Invalid thread cursor.' } },
      { status: 400 }
    )
  }

  const result = await dbActions.getChatsPage(userId, 50, offset)
  const threads = result.chats
    .filter(chat => chat.id.startsWith(OPENUI_CHAT_PREFIX))
    .map(toThread)

  return Response.json({
    threads,
    ...(result.nextOffset !== null
      ? { nextCursor: String(result.nextOffset) }
      : {})
  })
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return Response.json({ error: { message: 'Not allowed.' } }, { status: 403 })
  }
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: { message: 'Request body is too large.' } },
      { status: 413 }
    )
  }

  let message: StoredMessage | null
  try {
    message = parseMessage(
      (JSON.parse(rawBody) as { message?: unknown }).message
    )
  } catch {
    message = null
  }
  if (!message || message.role !== 'user') {
    return Response.json(
      { error: { message: 'A valid first user message is required.' } },
      { status: 400 }
    )
  }

  const id = `${OPENUI_CHAT_PREFIX}${generateId()}`
  const { chat } = await createChatWithFirstMessage(
    id,
    {
      id: message.id,
      role: message.role,
      parts: [{ type: 'text' as const, text: message.content }],
      metadata: { openuiMessage: message }
    },
    userId,
    titleFromMessage(message)
  )

  return Response.json({ thread: toThread(chat) })
}
