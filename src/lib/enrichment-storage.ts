/**
 * IndexedDB persistence for enrichment queue state.
 * Stores per-book queue progress so enrichment can resume across sessions.
 */

import type { Character } from "@/data/sampleBooks";

export type ChapterEnrichmentStatus = "pending" | "processing" | "completed" | "error";

export interface ChapterEnrichment {
  chapterId: string;
  status: ChapterEnrichmentStatus;
  annotationProgress: number; // 0-100
  annotations: Record<string, string>; // sentenceId -> annotation text
  error?: string;
}

export interface EnrichmentQueueState {
  bookId: string;
  status: "idle" | "running" | "paused" | "completed" | "error";
  globalCharacters: Character[];
  globalThemes: string[];
  chapters: ChapterEnrichment[];
  currentChapterId: string | null;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "storyworld-enrichment";
const DB_VERSION = 1;
const STORE_NAME = "queues";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "bookId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadQueueState(bookId: string): Promise<EnrichmentQueueState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(bookId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function saveQueueState(state: EnrichmentQueueState): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ ...state, updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn("[EnrichmentStorage] Save failed:", err);
  }
}

export async function deleteQueueState(bookId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(bookId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // non-fatal
  }
}

export function createInitialQueueState(bookId: string, chapterIds: string[]): EnrichmentQueueState {
  return {
    bookId,
    status: "idle",
    globalCharacters: [],
    globalThemes: [],
    chapters: chapterIds.map((id) => ({
      chapterId: id,
      status: "pending",
      annotationProgress: 0,
      annotations: {},
    })),
    currentChapterId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
