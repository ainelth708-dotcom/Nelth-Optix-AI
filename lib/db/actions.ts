'use server'

import * as firestoreImpl from './actions-firestore'
import * as pgImpl from './actions-pg'

/**
 * Chat persistence dispatcher. Chat + message functions run on PostgreSQL
 * (Supabase, Drizzle) when CHAT_DB_BACKEND=supabase, otherwise on the legacy
 * Firestore implementation. Notes, library files and feedback stay on
 * Firestore (unchanged). Firebase Authentication is untouched everywhere:
 * every function below receives only server-verified Firebase UIDs and all
 * rows remain keyed by that UID.
 */

export type NotesPageCursor = {
  updatedAt: string
  id: string
}

export type FilesPageCursor = {
  updatedAt: string
  id: string
}

function usePostgres(): boolean {
  return process.env.CHAT_DB_BACKEND === 'supabase'
}

// ---------------------------------------------------------------------------
// Chats (backend-switchable)
// ---------------------------------------------------------------------------

export async function createChat(
  ...args: Parameters<typeof firestoreImpl.createChat>
): Promise<Awaited<ReturnType<typeof firestoreImpl.createChat>>> {
  if (usePostgres()) return pgImpl.createChat(...args) as never
  return firestoreImpl.createChat(...args)
}

export async function getChat(
  ...args: Parameters<typeof firestoreImpl.getChat>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getChat>>> {
  if (usePostgres()) return pgImpl.getChat(...args) as never
  return firestoreImpl.getChat(...args)
}

export async function upsertMessage(
  ...args: Parameters<typeof firestoreImpl.upsertMessage>
): Promise<Awaited<ReturnType<typeof firestoreImpl.upsertMessage>>> {
  if (usePostgres()) return pgImpl.upsertMessage(...args) as never
  return firestoreImpl.upsertMessage(...args)
}

export async function loadChat(
  ...args: Parameters<typeof firestoreImpl.loadChat>
): Promise<Awaited<ReturnType<typeof firestoreImpl.loadChat>>> {
  if (usePostgres()) return pgImpl.loadChat(...args) as never
  return firestoreImpl.loadChat(...args)
}

export async function findExistingAssistantId(
  ...args: Parameters<typeof firestoreImpl.findExistingAssistantId>
): Promise<Awaited<ReturnType<typeof firestoreImpl.findExistingAssistantId>>> {
  if (usePostgres()) return pgImpl.findExistingAssistantId(...args) as never
  return firestoreImpl.findExistingAssistantId(...args)
}

export async function loadChatWithMessages(
  ...args: Parameters<typeof firestoreImpl.loadChatWithMessages>
): Promise<Awaited<ReturnType<typeof firestoreImpl.loadChatWithMessages>>> {
  if (usePostgres()) return pgImpl.loadChatWithMessages(...args) as never
  return firestoreImpl.loadChatWithMessages(...args)
}

export async function deleteMessagesAfter(
  ...args: Parameters<typeof firestoreImpl.deleteMessagesAfter>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteMessagesAfter>>> {
  if (usePostgres()) return pgImpl.deleteMessagesAfter(...args) as never
  return firestoreImpl.deleteMessagesAfter(...args)
}

export async function deleteMessagesFromIndex(
  ...args: Parameters<typeof firestoreImpl.deleteMessagesFromIndex>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteMessagesFromIndex>>> {
  if (usePostgres()) return pgImpl.deleteMessagesFromIndex(...args) as never
  return firestoreImpl.deleteMessagesFromIndex(...args)
}

export async function getChats(
  ...args: Parameters<typeof firestoreImpl.getChats>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getChats>>> {
  if (usePostgres()) return pgImpl.getChats(...args) as never
  return firestoreImpl.getChats(...args)
}

export async function getChatsPage(
  ...args: Parameters<typeof firestoreImpl.getChatsPage>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getChatsPage>>> {
  if (usePostgres()) return pgImpl.getChatsPage(...args) as never
  return firestoreImpl.getChatsPage(...args)
}

export async function deleteChat(
  ...args: Parameters<typeof firestoreImpl.deleteChat>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteChat>>> {
  if (usePostgres()) return pgImpl.deleteChat(...args) as never
  return firestoreImpl.deleteChat(...args)
}

export async function deleteUserChats(
  ...args: Parameters<typeof firestoreImpl.deleteUserChats>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteUserChats>>> {
  if (usePostgres()) return pgImpl.deleteUserChats(...args) as never
  return firestoreImpl.deleteUserChats(...args)
}

export async function updateChatVisibility(
  ...args: Parameters<typeof firestoreImpl.updateChatVisibility>
): Promise<Awaited<ReturnType<typeof firestoreImpl.updateChatVisibility>>> {
  if (usePostgres()) return pgImpl.updateChatVisibility(...args) as never
  return firestoreImpl.updateChatVisibility(...args)
}

export async function updateChatTitle(
  ...args: Parameters<typeof firestoreImpl.updateChatTitle>
): Promise<Awaited<ReturnType<typeof firestoreImpl.updateChatTitle>>> {
  if (usePostgres()) return pgImpl.updateChatTitle(...args) as never
  return firestoreImpl.updateChatTitle(...args)
}

export async function createChatWithFirstMessageTransaction(
  ...args: Parameters<typeof firestoreImpl.createChatWithFirstMessageTransaction>
): Promise<
  Awaited<ReturnType<typeof firestoreImpl.createChatWithFirstMessageTransaction>>
> {
  if (usePostgres()) {
    return pgImpl.createChatWithFirstMessageTransaction(...args) as never
  }
  return firestoreImpl.createChatWithFirstMessageTransaction(...args)
}

// ---------------------------------------------------------------------------
// Notes / library files / feedback (Firestore, unchanged)
// ---------------------------------------------------------------------------

export async function createNote(
  ...args: Parameters<typeof firestoreImpl.createNote>
): Promise<Awaited<ReturnType<typeof firestoreImpl.createNote>>> {
  return firestoreImpl.createNote(...args)
}

export async function getNotes(
  ...args: Parameters<typeof firestoreImpl.getNotes>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getNotes>>> {
  return firestoreImpl.getNotes(...args)
}

export async function searchNotes(
  ...args: Parameters<typeof firestoreImpl.searchNotes>
): Promise<Awaited<ReturnType<typeof firestoreImpl.searchNotes>>> {
  return firestoreImpl.searchNotes(...args)
}

export async function getNote(
  ...args: Parameters<typeof firestoreImpl.getNote>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getNote>>> {
  return firestoreImpl.getNote(...args)
}

export async function deleteNote(
  ...args: Parameters<typeof firestoreImpl.deleteNote>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteNote>>> {
  return firestoreImpl.deleteNote(...args)
}

export async function deleteUserNotes(
  ...args: Parameters<typeof firestoreImpl.deleteUserNotes>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteUserNotes>>> {
  return firestoreImpl.deleteUserNotes(...args)
}

export async function createLibraryFile(
  ...args: Parameters<typeof firestoreImpl.createLibraryFile>
): Promise<Awaited<ReturnType<typeof firestoreImpl.createLibraryFile>>> {
  return firestoreImpl.createLibraryFile(...args)
}

export async function getLibraryFiles(
  ...args: Parameters<typeof firestoreImpl.getLibraryFiles>
): Promise<Awaited<ReturnType<typeof firestoreImpl.getLibraryFiles>>> {
  return firestoreImpl.getLibraryFiles(...args)
}

export async function searchLibraryFiles(
  ...args: Parameters<typeof firestoreImpl.searchLibraryFiles>
): Promise<Awaited<ReturnType<typeof firestoreImpl.searchLibraryFiles>>> {
  return firestoreImpl.searchLibraryFiles(...args)
}

export async function deleteLibraryFile(
  ...args: Parameters<typeof firestoreImpl.deleteLibraryFile>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteLibraryFile>>> {
  return firestoreImpl.deleteLibraryFile(...args)
}

export async function deleteUserLibraryFiles(
  ...args: Parameters<typeof firestoreImpl.deleteUserLibraryFiles>
): Promise<Awaited<ReturnType<typeof firestoreImpl.deleteUserLibraryFiles>>> {
  return firestoreImpl.deleteUserLibraryFiles(...args)
}

export async function anonymizeUserFeedback(
  ...args: Parameters<typeof firestoreImpl.anonymizeUserFeedback>
): Promise<Awaited<ReturnType<typeof firestoreImpl.anonymizeUserFeedback>>> {
  return firestoreImpl.anonymizeUserFeedback(...args)
}
