import { useCallback } from "react";

const STORAGE_KEY = "storyworld-reading-progress";

interface ReadingProgress {
  bookId: string;
  chapterId: string;
  sentenceIndex: number;
  timestamp: number;
}

interface AllProgress {
  [bookId: string]: ReadingProgress;
}

function getAllProgress(): AllProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AllProgress;
  } catch {
    return {};
  }
}

export function useReadingProgress(bookId: string | null, chapterId: string | null) {
  const save = useCallback(
    (sentenceIndex: number) => {
      if (!bookId || !chapterId) return;
      try {
        const all = getAllProgress();
        all[bookId] = { bookId, chapterId, sentenceIndex, timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch {}
    },
    [bookId, chapterId]
  );

  const load = useCallback((): ReadingProgress | null => {
    if (!bookId) {
      // Return most recent across all books
      const all = getAllProgress();
      const entries = Object.values(all);
      if (entries.length === 0) return null;
      return entries.sort((a, b) => b.timestamp - a.timestamp)[0];
    }
    const all = getAllProgress();
    return all[bookId] ?? null;
  }, [bookId]);

  return { save, load };
}
