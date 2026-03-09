import { useState, useCallback, useMemo } from "react";
import { Book, sampleBooks } from "@/data/sampleBooks";

const STORAGE_KEY = "storyworld-library";

function loadImported(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Book[];
  } catch {}
  return [];
}

function saveImported(books: Book[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (err) {
    console.warn("[BookLibrary] Save failed:", err);
  }
}

export function useBookLibrary() {
  const [imported, setImported] = useState<Book[]>(loadImported);
  const books = useMemo(() => [...sampleBooks, ...imported], [imported]);

  const addBook = useCallback((book: Book) => {
    setImported((prev) => {
      const next = [...prev, book];
      saveImported(next);
      return next;
    });
  }, []);

  const removeBook = useCallback((bookId: string) => {
    setImported((prev) => {
      const next = prev.filter((b) => b.id !== bookId);
      saveImported(next);
      return next;
    });
  }, []);

  const updateBook = useCallback((bookId: string, patch: Partial<Book>) => {
    setImported((prev) => {
      const next = prev.map((b) => (b.id === bookId ? { ...b, ...patch } : b));
      saveImported(next);
      return next;
    });
  }, []);

  return { books, addBook, removeBook, updateBook };
}
