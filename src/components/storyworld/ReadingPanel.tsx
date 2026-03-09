import { Book, Chapter, Sentence } from "@/data/sampleBooks";
import { SentenceRenderer } from "./SentenceRenderer";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, BookOpen, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagedReader } from "@/hooks/usePagedReader";

export type FontSize = "small" | "medium" | "large";
export type ReadingMode = "scroll" | "page";

const fontSizeConfig: Record<FontSize, string> = {
  small: "text-[14px] sm:text-[15px] leading-[1.75] tracking-[0.005em]",
  medium: "text-[16px] sm:text-[17.5px] leading-[1.85] tracking-[0.01em]",
  large: "text-[18px] sm:text-[20px] leading-[1.9] tracking-[0.01em]",
};

interface ReadingPanelProps {
  book: Book;
  chapter: Chapter;
  activeSentenceIndex: number;
  isPlaying: boolean;
  voiceEnabled: boolean;
  fontSize: FontSize;
  readingMode: ReadingMode;
  onSelectSentence: (sentence: Sentence) => void;
  onBackToLibrary: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onFontSizeChange: (size: FontSize) => void;
  onReadingModeChange: (mode: ReadingMode) => void;
}

export function ReadingPanel({
  book,
  chapter,
  activeSentenceIndex,
  isPlaying,
  voiceEnabled,
  fontSize,
  readingMode,
  onSelectSentence,
  onBackToLibrary,
  onPrevChapter,
  onNextChapter,
  onFontSizeChange,
  onReadingModeChange,
}: ReadingPanelProps) {
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const chapterIndex = book.chapters.findIndex((c) => c.id === chapter.id);
  const totalChapters = book.chapters.length;
  const hasPrev = chapterIndex > 0;
  const hasNext = chapterIndex < totalChapters - 1;

  const isPageMode = readingMode === "page";

  const sentenceIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const scene of chapter.scenes) {
      for (const sentence of scene.sentences) {
        map.set(sentence.id, idx++);
      }
    }
    return map;
  }, [chapter]);

  const {
    containerRef: pagedOuterRef,
    innerRef: pagedInnerRef,
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
  } = usePagedReader({
    enabled: isPageMode,
    onNextChapter: hasNext ? onNextChapter : undefined,
    onPrevChapter: hasPrev ? onPrevChapter : undefined,
  });

  // Reset page when chapter changes
  useEffect(() => {
    if (isPageMode) resetPage();
  }, [chapter.id, isPageMode, resetPage]);

  // Recalc when font size changes
  useEffect(() => {
    if (isPageMode) {
      setTimeout(recalcPages, 150);
    }
  }, [fontSize, isPageMode, recalcPages]);

  // Scroll mode: auto-scroll to active sentence
  useEffect(() => {
    if (!isPageMode && isPlaying && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSentenceIndex, isPlaying, isPageMode]);

  // Page mode: navigate to page containing active sentence
  useEffect(() => {
    if (isPageMode && isPlaying && activeSentenceRef.current) {
      goToPageContainingElement(activeSentenceRef.current);
    }
  }, [activeSentenceIndex, isPlaying, isPageMode, goToPageContainingElement]);

  const cycleFontSize = (dir: "up" | "down") => {
    const sizes: FontSize[] = ["small", "medium", "large"];
    const idx = sizes.indexOf(fontSize);
    if (dir === "up" && idx < sizes.length - 1) onFontSizeChange(sizes[idx + 1]);
    if (dir === "down" && idx > 0) onFontSizeChange(sizes[idx - 1]);
  };

  const toggleReadingMode = useCallback(() => {
    onReadingModeChange(isPageMode ? "scroll" : "page");
  }, [isPageMode, onReadingModeChange]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top navigation bar */}
      <div className="flex items-center gap-2 px-3 sm:px-6 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <button
          onClick={onBackToLibrary}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          aria-label="Back to library"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[12px] font-mono hidden sm:inline">Library</span>
        </button>

        <div className="h-4 w-px bg-border" />

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[12px] font-medium truncate text-foreground">
            {book.title}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">·</span>
          <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
            {chapter.title}
          </span>
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => cycleFontSize("down")}
            disabled={fontSize === "small"}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Decrease font size"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-[9px] font-mono text-muted-foreground w-5 text-center">
            {fontSize === "small" ? "A" : fontSize === "medium" ? "A" : "A"}
          </span>
          <button
            onClick={() => cycleFontSize("up")}
            disabled={fontSize === "large"}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Increase font size"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Reading mode toggle */}
        <button
          onClick={toggleReadingMode}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/50"
          aria-label={isPageMode ? "Switch to scroll mode" : "Switch to page mode"}
          title={isPageMode ? "Scroll mode" : "Page mode"}
        >
          {isPageMode ? <ScrollText className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
        </button>

        <div className="h-4 w-px bg-border" />

        <ThemeToggle />

        <div className="h-4 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevChapter}
            disabled={!hasPrev}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Previous chapter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {chapterIndex + 1}/{totalChapters}
          </span>
          <button
            onClick={onNextChapter}
            disabled={!hasNext}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Next chapter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reading content */}
      {isPageMode ? (
        /* Paginated mode */
        <div
          className="flex-1 overflow-hidden relative select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onTapZone}
        >
          <div
            ref={pagedContainerRef}
            className="h-full px-4 sm:px-8 py-8 sm:py-12 transition-transform duration-300 ease-in-out"
            style={{
              columnWidth: "100%",
              columnFill: "auto",
              columnGap: "0px",
            }}
          >
            <div className="max-w-[680px] mx-auto">
              <h2 className="text-2xl sm:text-[28px] font-bold font-serif text-primary mb-8 tracking-wide break-after-avoid">
                {chapter.title}
              </h2>

              {chapter.scenes.map((scene, sceneIdx) => (
                <div key={scene.id} className="mb-10">
                  {sceneIdx > 0 && (
                    <div className="flex items-center gap-4 my-8">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                        {scene.title}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {sceneIdx === 0 && (
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">
                      {scene.title}
                    </p>
                  )}

                  <div className={cn("text-foreground", fontSizeConfig[fontSize])}>
                    {scene.sentences.map((sentence) => {
                      const idx = sentenceIndexMap.get(sentence.id) ?? 0;
                      const isActive = idx === activeSentenceIndex && isPlaying;
                      return (
                        <SentenceRenderer
                          key={sentence.id}
                          ref={isActive ? activeSentenceRef : undefined}
                          sentence={sentence}
                          index={idx}
                          activeSentenceIndex={activeSentenceIndex}
                          isPlaying={isPlaying}
                          voiceEnabled={voiceEnabled}
                          onSelect={onSelectSentence}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Page indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-sm pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); prevPage(); }}
                disabled={currentPage <= 0 && !hasPrev}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); nextPage(); }}
                disabled={currentPage >= totalPages - 1 && !hasNext}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Scroll mode (existing) */
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
            <h2 className="text-2xl sm:text-[28px] font-bold font-serif text-primary mb-8 tracking-wide">
              {chapter.title}
            </h2>

            {chapter.scenes.map((scene, sceneIdx) => (
              <div key={scene.id} className="mb-10">
                {sceneIdx > 0 && (
                  <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      {scene.title}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {sceneIdx === 0 && (
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">
                    {scene.title}
                  </p>
                )}

                <div className={cn("text-foreground", fontSizeConfig[fontSize])}>
                  {scene.sentences.map((sentence) => {
                    const idx = sentenceIndexMap.get(sentence.id) ?? 0;
                    const isActive = idx === activeSentenceIndex && isPlaying;
                    return (
                      <SentenceRenderer
                        key={sentence.id}
                        ref={isActive ? activeSentenceRef : undefined}
                        sentence={sentence}
                        index={idx}
                        activeSentenceIndex={activeSentenceIndex}
                        isPlaying={isPlaying}
                        voiceEnabled={voiceEnabled}
                        onSelect={onSelectSentence}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* End of chapter prompt */}
            {hasNext && (
              <div className="mt-12 mb-8 flex flex-col items-center gap-3">
                <div className="h-px w-24 bg-border" />
                <button
                  onClick={onNextChapter}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <span className="text-[13px] font-medium text-foreground">
                    Continue to {book.chapters[chapterIndex + 1]?.title}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}

            {!hasNext && (
              <div className="mt-12 mb-8 flex flex-col items-center gap-3">
                <div className="h-px w-24 bg-border" />
                <p className="text-[12px] font-mono text-muted-foreground">End of book</p>
                <button
                  onClick={onBackToLibrary}
                  className="text-[12px] text-primary hover:underline"
                >
                  Return to Library
                </button>
              </div>
            )}

            <div className="h-32" />
          </div>
        </div>
      )}
    </div>
  );
}
