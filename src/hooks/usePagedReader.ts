import { useCallback, useEffect, useRef, useState } from "react";

interface UsePagedReaderOptions {
  enabled: boolean;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
}

export function usePagedReader({ enabled, onNextChapter, onPrevChapter }: UsePagedReaderOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalcPages = useCallback(() => {
    const outer = containerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || !enabled) return;

    const cs = window.getComputedStyle(outer);
    const padL = Number.parseFloat(cs.paddingLeft || "0") || 0;
    const padR = Number.parseFloat(cs.paddingRight || "0") || 0;

    // Content-box width = one page of visible text
    const pageWidth = outer.clientWidth - padL - padR;
    if (pageWidth <= 0) return;

    const prevTransform = inner.style.transform;
    inner.style.transform = "none";
    inner.style.columnWidth = `${pageWidth}px`;

    // Force reflow then measure
    void inner.offsetHeight;

    // Read the computed column gap (could be set via CSS)
    const innerCs = window.getComputedStyle(inner);
    const gap = Number.parseFloat(innerCs.columnGap || "0") || 0;

    const scrollW = inner.scrollWidth;
    // Each column slot = pageWidth + gap, except the last which has no trailing gap
    const slotWidth = pageWidth + gap;
    const pages = Math.max(1, Math.round((scrollW + gap) / slotWidth));

    inner.style.transform = prevTransform || "translateX(0px)";

    // Store the slot width (page + gap) as the amount to translate per page
    setContainerWidth(slotWidth);
    setTotalPages(pages);
    setCurrentPage((prev) => Math.min(prev, pages - 1));
  }, [enabled]);

  // Apply transform whenever page or width changes
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || !enabled || containerWidth === 0) return;
    const offset = currentPage * containerWidth;
    requestAnimationFrame(() => {
      inner.style.transform = `translateX(-${offset}px)`;
    });
  }, [currentPage, enabled, containerWidth]);

  // Observe resize + mutations
  useEffect(() => {
    if (!enabled) return;
    const outer = containerRef.current;
    if (!outer) return;

    const schedule = () => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
      recalcTimer.current = setTimeout(recalcPages, 80);
    };

    const resObs = new ResizeObserver(schedule);
    resObs.observe(outer);

    const mutObs = new MutationObserver(schedule);
    const inner = innerRef.current;
    if (inner) {
      mutObs.observe(inner, { childList: true, subtree: true, characterData: true });
    }

    // Initial calc after content renders
    setTimeout(recalcPages, 100);

    return () => {
      resObs.disconnect();
      mutObs.disconnect();
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
    };
  }, [enabled, recalcPages]);

  const resetPage = useCallback(() => {
    setCurrentPage(0);
    setTimeout(recalcPages, 150);
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

  const goToPageContainingElement = useCallback((element: HTMLElement) => {
    if (!enabled || containerWidth === 0) return;
    const page = Math.floor(element.offsetLeft / containerWidth);
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [enabled, containerWidth, totalPages]);

  // Swipe
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

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) nextPage();
      else prevPage();
    }
  }, [enabled, nextPage, prevPage]);

  // Tap zones (ignore taps on interactive content like sentences/buttons)
  const onTapZone = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;

    try {
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest(
          "button, a, input, textarea, select, [role='button'], [data-sentence='true'], [data-no-pager-tap='true']"
        );
        if (interactive) return;

        const selected = window.getSelection?.()?.toString?.() ?? "";
        if (selected.trim().length > 0) return;
      }
    } catch {
      // ignore
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 0.3) prevPage();
    else if (ratio > 0.7) nextPage();
  }, [enabled, nextPage, prevPage]);

  return {
    containerRef,
    innerRef,
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
