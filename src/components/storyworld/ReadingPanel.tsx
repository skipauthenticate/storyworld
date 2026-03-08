import { Book, Chapter, Sentence } from "@/data/sampleBooks";
import { SentenceRenderer } from "./SentenceRenderer";
import { useEffect, useRef, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface ReadingPanelProps {
  book: Book;
  chapter: Chapter;
  activeSentenceIndex: number;
  isPlaying: boolean;
  voiceEnabled: boolean;
  onSelectSentence: (sentence: Sentence) => void;
  onBackToLibrary: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

export function ReadingPanel({
  book,
  chapter,
  activeSentenceIndex,
  isPlaying,
  voiceEnabled,
  onSelectSentence,
  onBackToLibrary,
  onPrevChapter,
  onNextChapter,
}: ReadingPanelProps) {
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  const chapterIndex = book.chapters.findIndex((c) => c.id === chapter.id);
  const totalChapters = book.chapters.length;
  const hasPrev = chapterIndex > 0;
  const hasNext = chapterIndex < totalChapters - 1;

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

  useEffect(() => {
    if (isPlaying && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSentenceIndex, isPlaying]);

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
      <div className="flex-1 overflow-y-auto">
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

              <div className="text-[16px] sm:text-[17.5px] leading-[1.85] tracking-[0.01em] text-foreground">
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
    </div>
  );
}
