import { useCallback, useEffect, useRef, useState } from "react";

interface UsePagedReaderOptions {
  enabled: boolean;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
}

export function usePagedReader({ enabled, onNextChapter, onPrevChapter }: UsePagedReaderOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalcPages = useCallback(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const width = el.clientWidth;
    if (width === 0) return;
    const pages = Math.max(1, Math.round(el.scrollWidth / width));
    setTotalPages(pages);
    setCurrentPage((prev) => Math.min(prev, pages - 1));
  }, [enabled]);

  // Recalc on resize / content change
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
      recalcTimer.current = setTimeout(recalcPages, 80);
    });
    observer.observe(el);

    // Also observe mutations (content changes from enrichment)
    const mutObs = new MutationObserver(() => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
      recalcTimer.current = setTimeout(recalcPages, 80);
    });
    mutObs.observe(el, { childList: true, subtree: true, characterData: true });

    // Initial calc
    setTimeout(recalcPages, 50);

    return () => {
      observer.disconnect();
      mutObs.disconnect();
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
    };
  }, [enabled, recalcPages]);

  // Reset page on chapter change (content changes)
  const resetPage = useCallback(() => {
    setCurrentPage(0);
    setTimeout(recalcPages, 100);
  }, [recalcPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev >= totalPages - 1) {
        onNextChapter?.();
        return prev;
      }
      return prev + 1;
    });
  }, [totalPages, onNextChapter]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev <= 0) {
        onPrevChapter?.();
        return prev;
      }
      return prev - 1;
    });
  }, [onPrevChapter]);

  // Navigate to page containing a specific element
  const goToPageContainingElement = useCallback((element: HTMLElement) => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;
    const page = Math.floor(element.offsetLeft / containerWidth);
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [enabled, totalPages]);

  // Apply CSS transform for current page
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const offset = currentPage * el.clientWidth;
    el.style.transform = `translateX(-${offset}px)`;
  }, [currentPage, enabled]);

  // Pointer events for swipe
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, [enabled]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!enabled || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dt = Date.now() - pointerStart.current.time;
    pointerStart.current = null;

    // Must be more horizontal than vertical and meet threshold
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) nextPage();
      else prevPage();
    }
  }, [enabled, nextPage, prevPage]);

  // Tap zones: left 30% = prev, right 30% = next
  const onTapZone = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 0.3) prevPage();
    else if (ratio > 0.7) nextPage();
  }, [enabled, nextPage, prevPage]);

  return {
    containerRef,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    resetPage,
    goToPageContainingElement,
    recalcPages,
    onPointerDown,
    onPointerUp,
    onTapZone,
  };
}
