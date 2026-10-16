import type { Message } from '@openuidev/react-ui'

import { deleteMessagesFromIndex, upsertMessage } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import {
  MAX_BODY_BYTES,
  OPENUI_CHAT_PREFIX,
  parseMessage,
  toThread
} from '@/lib/openui/persistence'
import type { UIMessage } from '@/lib/types/ai'
import { getTextFromParts } from '@/lib/utils/message-utils'

import { hasAllowedOrigin } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/same-origin'

type RouteContext = { params: Promise<{ threadId: string }> }

function unauthorized() {
  return Response.json(
    { error: { message: 'Authentication required.' } },
    { status: 401 }
  )
}

function contentOf(message: UIMessage): string {
  return getTextFromParts(message.parts)
}

function toOpenUIMessage(message: UIMessage): Message | null {
  if (message.role !== 'user' && message.role !== 'assistant') return null
  const metadata =
    message.metadata && typeof message.metadata === 'object'
      ? (message.metadata as Record<string, unknown>)
      : undefined
  const saved = metadata?.openuiMessage
  const savedMessage =
    saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {}

  return {
    ...savedMessage,
    id: message.id,
    role: message.role,
    content: contentOf(message)
  } as Message
}

async function getOwnedThread(threadId: string, userId: string) {
  if (!threadId.startsWith(OPENUI_CHAT_PREFIX)) return null
  const chat = await dbActions.getChat(threadId, userId)
  return chat?.userId === userId ? chat : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const { threadId } = await params
  const chat = await getOwnedThread(threadId, userId)
  if (!chat) {
    return Response.json(
      { error: { message: 'Conversation not found.' } },
      { status: 404 }
    )
  }

  const messages = await dbActions.loadChat(threadId, userId)
  return Response.json({
    messages: messages.flatMap(message => {
      const converted = toOpenUIMessage(message)
      return converted ? [converted] : []
    })
  })
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!hasAllowedOrigin(request)) {
    return Response.json(
      { error: { message: 'Not allowed.' } },
      { status: 403 }
    )
  }
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const { threadId } = await params
  const chat = await getOwnedThread(threadId, userId)
  if (!chat) {
    return Response.json(
      { error: { message: 'Conversation not found.' } },
      { status: 404 }
    )
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: { message: 'Request body is too large.' } },
      { status: 413 }
    )
  }

  let messages: ReturnType<typeof parseMessage>[]
  try {
    const rawMessages = (JSON.parse(rawBody) as { messages?: unknown }).messages
    if (!Array.isArray(rawMessages) || rawMessages.length > 60) {
      return Response.json(
        { error: { message: 'A valid messages array is required.' } },
        { status: 400 }
      )
    }
    messages = rawMessages.map(parseMessage)
  } catch {
    return Response.json(
      { error: { message: 'Invalid JSON request body.' } },
      { status: 400 }
    )
  }

  if (messages.some(message => message === null)) {
    return Response.json(
      { error: { message: 'A conversation message is invalid.' } },
      { status: 400 }
    )
  }

  const incoming = messages.filter(
    (message): message is NonNullable<typeof message> => message !== null
  )
  const existing = await dbActions.loadChat(threadId, userId)
  const firstChanged = existing.find(
    (message, index) => incoming[index]?.id !== message.id
  )
  if (firstChanged) {
    await deleteMessagesFromIndex(threadId, firstChanged.id, userId)
  }

  for (const message of incoming) {
    await upsertMessage(
      threadId,
      {
        id: message.id,
        role: message.role,
        parts: [{ type: 'text', text: message.content }],
        metadata: { openuiMessage: message }
      },
      userId
    )
  }

  return Response.json({ success: true as const })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!hasAllowedOrigin(request)) {
    return Response.json(
      { error: { message: 'Not allowed.' } },
      { status: 403 }
    )
  }
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const { threadId } = await params
  const chat = await getOwnedThread(threadId, userId)
  if (!chat) {
    return Response.json(
      { error: { message: 'Conversation not found.' } },
      { status: 404 }
    )
  }

  let title: unknown
  try {
    title = (await request.json()).title
  } catch {
    return Response.json(
      { error: { message: 'Invalid JSON request body.' } },
      { status: 400 }
    )
  }
  if (typeof title !== 'string' || !title.trim() || title.length > 255) {
    return Response.json(
      { error: { message: 'A valid conversation title is required.' } },
      { status: 400 }
    )
  }

  const updated = await dbActions.updateChatTitle(
    threadId,
    title.trim(),
    userId
  )
  if (!updated) {
    return Response.json(
      { error: { message: 'Conversation could not be updated.' } },
      { status: 500 }
    )
  }

  return Response.json({ thread: toThread(updated) })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!hasAllowedOrigin(_request)) {
    return Response.json(
      { error: { message: 'Not allowed.' } },
      { status: 403 }
    )
  }
  const userId = await getCurrentUserId()
  if (!userId) return unauthorized()

  const { threadId } = await params
  const chat = await getOwnedThread(threadId, userId)
  if (!chat) {
    return Response.json(
      { error: { message: 'Conversation not found.' } },
      { status: 404 }
    )
  }

  const result = await dbActions.deleteChat(threadId, userId)
  if (!result.success) {
    return Response.json(
      {
        error: { message: result.error ?? 'Conversation could not be deleted.' }
      },
      { status: 500 }
    )
  }
  return Response.json({ success: true as const })
}
