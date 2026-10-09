'use server'

import * as pgImpl from './actions-pg'

/**
 * Persistence entry point. Everything runs on PostgreSQL (Supabase,
 * Drizzle); Firebase Authentication is untouched: every function below
 * receives only server-verified Firebase UIDs and all rows remain keyed by
 * that UID. (The legacy Firestore implementation was removed; notes,
 * library files and feedback moved to PostgreSQL with it.)
 */

export type NotesPageCursor = {
  updatedAt: string
  id: string
}

export type FilesPageCursor = {
  updatedAt: string
  id: string
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

export async function createChat(
  ...args: Parameters<typeof pgImpl.createChat>
): Promise<Awaited<ReturnType<typeof pgImpl.createChat>>> {
  return pgImpl.createChat(...args)
}

export async function getChat(
  ...args: Parameters<typeof pgImpl.getChat>
): Promise<Awaited<ReturnType<typeof pgImpl.getChat>>> {
  return pgImpl.getChat(...args)
}

export async function upsertMessage(
  ...args: Parameters<typeof pgImpl.upsertMessage>
): Promise<Awaited<ReturnType<typeof pgImpl.upsertMessage>>> {
  return pgImpl.upsertMessage(...args)
}

export async function loadChat(
  ...args: Parameters<typeof pgImpl.loadChat>
): Promise<Awaited<ReturnType<typeof pgImpl.loadChat>>> {
  return pgImpl.loadChat(...args)
}

export async function findExistingAssistantId(
  ...args: Parameters<typeof pgImpl.findExistingAssistantId>
): Promise<Awaited<ReturnType<typeof pgImpl.findExistingAssistantId>>> {
  return pgImpl.findExistingAssistantId(...args)
}

export async function loadChatWithMessages(
  ...args: Parameters<typeof pgImpl.loadChatWithMessages>
): Promise<Awaited<ReturnType<typeof pgImpl.loadChatWithMessages>>> {
  return pgImpl.loadChatWithMessages(...args)
}

export async function deleteMessagesAfter(
  ...args: Parameters<typeof pgImpl.deleteMessagesAfter>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteMessagesAfter>>> {
  return pgImpl.deleteMessagesAfter(...args)
}

export async function deleteMessagesFromIndex(
  ...args: Parameters<typeof pgImpl.deleteMessagesFromIndex>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteMessagesFromIndex>>> {
  return pgImpl.deleteMessagesFromIndex(...args)
}

export async function getChats(
  ...args: Parameters<typeof pgImpl.getChats>
): Promise<Awaited<ReturnType<typeof pgImpl.getChats>>> {
  return pgImpl.getChats(...args)
}

export async function getChatsPage(
  ...args: Parameters<typeof pgImpl.getChatsPage>
): Promise<Awaited<ReturnType<typeof pgImpl.getChatsPage>>> {
  return pgImpl.getChatsPage(...args)
}

export async function deleteChat(
  ...args: Parameters<typeof pgImpl.deleteChat>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteChat>>> {
  return pgImpl.deleteChat(...args)
}

export async function deleteUserChats(
  ...args: Parameters<typeof pgImpl.deleteUserChats>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteUserChats>>> {
  return pgImpl.deleteUserChats(...args)
}

export async function updateChatVisibility(
  ...args: Parameters<typeof pgImpl.updateChatVisibility>
): Promise<Awaited<ReturnType<typeof pgImpl.updateChatVisibility>>> {
  return pgImpl.updateChatVisibility(...args)
}

export async function updateChatTitle(
  ...args: Parameters<typeof pgImpl.updateChatTitle>
): Promise<Awaited<ReturnType<typeof pgImpl.updateChatTitle>>> {
  return pgImpl.updateChatTitle(...args)
}

export async function createChatWithFirstMessageTransaction(
  ...args: Parameters<typeof pgImpl.createChatWithFirstMessageTransaction>
): Promise<
  Awaited<ReturnType<typeof pgImpl.createChatWithFirstMessageTransaction>>
> {
  return pgImpl.createChatWithFirstMessageTransaction(...args)
}

// ---------------------------------------------------------------------------
// Notes / library files / feedback
// ---------------------------------------------------------------------------

export async function createNote(
  ...args: Parameters<typeof pgImpl.createNote>
): Promise<Awaited<ReturnType<typeof pgImpl.createNote>>> {
  return pgImpl.createNote(...args)
}

export async function getNotes(
  ...args: Parameters<typeof pgImpl.getNotes>
): Promise<Awaited<ReturnType<typeof pgImpl.getNotes>>> {
  return pgImpl.getNotes(...args)
}

export async function searchNotes(
  ...args: Parameters<typeof pgImpl.searchNotes>
): Promise<Awaited<ReturnType<typeof pgImpl.searchNotes>>> {
  return pgImpl.searchNotes(...args)
}

export async function getNote(
  ...args: Parameters<typeof pgImpl.getNote>
): Promise<Awaited<ReturnType<typeof pgImpl.getNote>>> {
  return pgImpl.getNote(...args)
}

export async function deleteNote(
  ...args: Parameters<typeof pgImpl.deleteNote>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteNote>>> {
  return pgImpl.deleteNote(...args)
}

export async function deleteUserNotes(
  ...args: Parameters<typeof pgImpl.deleteUserNotes>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteUserNotes>>> {
  return pgImpl.deleteUserNotes(...args)
}

export async function createLibraryFile(
  ...args: Parameters<typeof pgImpl.createLibraryFile>
): Promise<Awaited<ReturnType<typeof pgImpl.createLibraryFile>>> {
  return pgImpl.createLibraryFile(...args)
}

export async function getLibraryFiles(
  ...args: Parameters<typeof pgImpl.getLibraryFiles>
): Promise<Awaited<ReturnType<typeof pgImpl.getLibraryFiles>>> {
  return pgImpl.getLibraryFiles(...args)
}

export async function searchLibraryFiles(
  ...args: Parameters<typeof pgImpl.searchLibraryFiles>
): Promise<Awaited<ReturnType<typeof pgImpl.searchLibraryFiles>>> {
  return pgImpl.searchLibraryFiles(...args)
}

export async function deleteLibraryFile(
  ...args: Parameters<typeof pgImpl.deleteLibraryFile>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteLibraryFile>>> {
  return pgImpl.deleteLibraryFile(...args)
}

export async function deleteUserLibraryFiles(
  ...args: Parameters<typeof pgImpl.deleteUserLibraryFiles>
): Promise<Awaited<ReturnType<typeof pgImpl.deleteUserLibraryFiles>>> {
  return pgImpl.deleteUserLibraryFiles(...args)
}

export async function anonymizeUserFeedback(
  ...args: Parameters<typeof pgImpl.anonymizeUserFeedback>
): Promise<Awaited<ReturnType<typeof pgImpl.anonymizeUserFeedback>>> {
  return pgImpl.anonymizeUserFeedback(...args)
}

