import { useEffect, useCallback } from "react";

const STORAGE_KEY = "storyworld-reading-progress";

interface ReadingProgress {
  bookId: string;
  chapterId: string;
  sentenceIndex: number;
  timestamp: number;
}

export function useReadingProgress(bookId: string | null, chapterId: string | null) {
  const save = useCallback(
    (sentenceIndex: number) => {
      if (!bookId || !chapterId) return;
      try {
        const data: ReadingProgress = { bookId, chapterId, sentenceIndex, timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    },
    [bookId, chapterId]
  );

  const load = useCallback((): ReadingProgress | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ReadingProgress;
    } catch {
      return null;
    }
  }, []);

  return { save, load };
}
