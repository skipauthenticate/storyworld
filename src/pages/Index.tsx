import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { sampleBooks, Book, Chapter, Sentence } from "@/data/sampleBooks";
import { LibrarySidebar } from "@/components/storyworld/LibrarySidebar";
import { ReadingPanel, FontSize } from "@/components/storyworld/ReadingPanel";
import { NarrationControls } from "@/components/storyworld/NarrationControls";
import { IntelligencePanel } from "@/components/storyworld/IntelligencePanel";
import { WelcomeScreen } from "@/components/storyworld/WelcomeScreen";
import { useNarration } from "@/hooks/useNarration";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useAutoResearch } from "@/hooks/useAutoResearch";
import { useBookLibrary } from "@/hooks/useBookLibrary";
import { useEnrichmentQueue } from "@/hooks/useEnrichmentQueue";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Zap } from "lucide-react";
import { parseEpub } from "@/lib/epub-parser";
import { toast } from "sonner";

const FONT_SIZE_KEY = "storyworld-font-size";

function loadFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONT_SIZE_KEY);
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch {}
  return "medium";
}

const Index = () => {
  const { books, addBook, removeBook, updateBook } = useBookLibrary();

  const handleBookUpdate = useCallback((bookId: string, patch: Partial<Book>) => {
    updateBook(bookId, patch);
  }, [updateBook]);

  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(null);
  const [importing, setImporting] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(loadFontSize);
  const isMobile = useIsMobile();

  const pendingSentenceRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef(false);

  const allSentences = activeChapter?.scenes.flatMap((s) => s.sentences) ?? [];

  const { triggerImprovement } = useAutoResearch();

  const handleChapterEnd = useCallback(() => {
    if (!activeBook || !activeChapter) return;
    const idx = activeBook.chapters.findIndex((c) => c.id === activeChapter.id);
    if (idx < activeBook.chapters.length - 1) {
      autoAdvanceRef.current = true;
      setActiveChapter(activeBook.chapters[idx + 1]);
      setSelectedSentence(null);
    }
  }, [activeBook, activeChapter]);

  const {
    isPlaying,
    activeSentenceIndex,
    ttsEngine,
    ttsLoading,
    togglePlay,
    goToNext,
    goToPrevious,
    goToSentence,
    setSpeed: setNarrationSpeed,
  } = useNarration({
    sentences: allSentences,
    speed,
    voiceEnabled,
    onChapterEnd: handleChapterEnd,
  });

  // Auto-advance: resume playing after chapter switch
  useEffect(() => {
    if (autoAdvanceRef.current && allSentences.length > 0) {
      autoAdvanceRef.current = false;
      setTimeout(() => togglePlay(), 100);
    }
  }, [allSentences]);

  // Restore sentence position after chapter load
  useEffect(() => {
    if (pendingSentenceRef.current !== null && allSentences.length > 0) {
      const idx = pendingSentenceRef.current;
      pendingSentenceRef.current = null;
      if (idx > 0 && idx < allSentences.length) {
        setTimeout(() => goToSentence(idx), 50);
      }
    }
  }, [allSentences]);

  const { save: saveProgress, load: loadProgress } = useReadingProgress(
    activeBook?.id ?? null,
    activeChapter?.id ?? null
  );

  useEffect(() => {
    if (activeBook && activeChapter) {
      try { saveProgress(activeSentenceIndex); } catch (_) {}
    }
  }, [activeSentenceIndex, activeBook, activeChapter, saveProgress]);

  // Restore reading progress on mount
  useEffect(() => {
    try {
      const progress = loadProgress();
      if (progress) {
        const book = books.find((b) => b.id === progress.bookId);
        if (book && book.chapters.length > 0) {
          setActiveBook(book);
          const chapter = book.chapters.find((c) => c.id === progress.chapterId);
          setActiveChapter(chapter ?? book.chapters[0]);
          if (progress.sentenceIndex > 0) {
            pendingSentenceRef.current = progress.sentenceIndex;
          }
        }
      }
    } catch (err) {
      console.warn('[Index] Failed to load reading progress:', err);
    }
  }, []);

  useEffect(() => {
    setNarrationSpeed(speed);
  }, [speed, setNarrationSpeed]);

  const handleFontSizeChange = useCallback((size: FontSize) => {
    setFontSize(size);
    try { localStorage.setItem(FONT_SIZE_KEY, size); } catch {}
  }, []);

  const bookProgress = useMemo(() => {
    if (!activeBook || !activeChapter) return 0;
    let total = 0;
    let current = 0;
    for (const ch of activeBook.chapters) {
      const count = ch.scenes.flatMap((s) => s.sentences).length;
      if (ch.id === activeChapter.id) {
        current = total + activeSentenceIndex;
      }
      total += count;
    }
    return total > 0 ? Math.round((current / total) * 100) : 0;
  }, [activeBook, activeChapter, activeSentenceIndex]);

  const handleSelectBook = useCallback((book: Book) => {
    setActiveBook(book);
    if (book.chapters.length > 0) {
      setActiveChapter(book.chapters[0]);
      setSelectedSentence(null);
    }
  }, []);

  const handleSelectChapter = useCallback((chapter: Chapter) => {
    setActiveChapter(chapter);
    setSelectedSentence(null);
    triggerImprovement("annotations", activeBook ?? undefined);
  }, [triggerImprovement, activeBook]);

  const handleSelectSentence = useCallback((sentence: Sentence) => {
    setSelectedSentence(sentence);
    const idx = allSentences.findIndex((s) => s.id === sentence.id);
    if (idx >= 0) goToSentence(idx);
    triggerImprovement("annotations", activeBook ?? undefined);
  }, [allSentences, goToSentence, triggerImprovement, activeBook]);

  const handleTogglePlay = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleBackToLibrary = useCallback(() => {
    setActiveBook(null);
    setActiveChapter(null);
    setSelectedSentence(null);
  }, []);

  const handleDeleteBook = useCallback((bookId: string) => {
    removeBook(bookId);
    if (activeBook?.id === bookId) {
      setActiveBook(null);
      setActiveChapter(null);
      setSelectedSentence(null);
    }
  }, [activeBook, removeBook]);

  const handlePrevChapter = useCallback(() => {
    if (!activeBook || !activeChapter) return;
    const idx = activeBook.chapters.findIndex((c) => c.id === activeChapter.id);
    if (idx > 0) {
      setActiveChapter(activeBook.chapters[idx - 1]);
      setSelectedSentence(null);
    }
  }, [activeBook, activeChapter]);

  const handleNextChapter = useCallback(() => {
    if (!activeBook || !activeChapter) return;
    const idx = activeBook.chapters.findIndex((c) => c.id === activeChapter.id);
    if (idx < activeBook.chapters.length - 1) {
      setActiveChapter(activeBook.chapters[idx + 1]);
      setSelectedSentence(null);
    }
  }, [activeBook, activeChapter]);

  const handleImportEpub = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const book = await parseEpub(file);
      addBook(book);
      setActiveBook(book);
      setActiveChapter(book.chapters[0] ?? null);
      setSelectedSentence(null);
      toast.success(`Imported "${book.title}" — ${book.chapters.length} chapters`);
    } catch (err) {
      console.error('[Index] EPUB import failed:', err);
      toast.error(err instanceof Error ? err.message : "Failed to import EPUB");
    } finally {
      setImporting(false);
    }
  }, [addBook]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      try {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        switch (e.key) {
          case " ":
            e.preventDefault();
            handleTogglePlay();
            break;
          case "ArrowLeft":
            goToPrevious();
            break;
          case "ArrowRight":
            goToNext();
            break;
        }
      } catch (err) {
        console.warn('[Index] Keyboard handler error:', err);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay, goToPrevious, goToNext]);

  const showRightPanel = intelligenceEnabled && activeBook;

  const chapterLabel = activeBook && activeChapter
    ? `${activeChapter.title} · ${activeBook.chapters.findIndex(c => c.id === activeChapter.id) + 1} of ${activeBook.chapters.length}`
    : "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground">
        Skip to content
      </a>

      <LibrarySidebar
        books={books}
        activeBook={activeBook}
        activeChapterId={activeChapter?.id ?? null}
        onSelectBook={handleSelectBook}
        onSelectChapter={handleSelectChapter}
        onImportEpub={handleImportEpub}
        onDeleteBook={handleDeleteBook}
        importing={importing}
      />

      <div id="main-content" className="flex-1 flex flex-col overflow-hidden">
        {activeChapter && activeBook ? (
          <>
            <ReadingPanel
              book={activeBook}
              chapter={activeChapter}
              activeSentenceIndex={activeSentenceIndex}
              isPlaying={isPlaying}
              voiceEnabled={voiceEnabled}
              fontSize={fontSize}
              onSelectSentence={handleSelectSentence}
              onBackToLibrary={handleBackToLibrary}
              onPrevChapter={handlePrevChapter}
              onNextChapter={handleNextChapter}
              onFontSizeChange={handleFontSizeChange}
            />
            <NarrationControls
              isPlaying={isPlaying}
              speed={speed}
              currentSentence={activeSentenceIndex}
              totalSentences={allSentences.length}
              bookProgress={bookProgress}
              ttsEngine={ttsEngine}
              ttsLoading={ttsLoading}
              voiceEnabled={voiceEnabled}
              intelligenceEnabled={intelligenceEnabled}
              chapterLabel={chapterLabel}
              onTogglePlay={handleTogglePlay}
              onPrevious={goToPrevious}
              onNext={goToNext}
              onSpeedChange={setSpeed}
              onToggleVoice={() => setVoiceEnabled((v) => !v)}
              onToggleIntelligence={() => setIntelligenceEnabled((v) => !v)}
            />
          </>
        ) : (
          <WelcomeScreen
            books={books}
            onSelectBook={handleSelectBook}
            onImportEpub={handleImportEpub}
            importing={importing}
          />
        )}
      </div>

      {/* Intelligence Panel — desktop sidebar or mobile sheet */}
      {showRightPanel && activeBook && !isMobile && (
        <IntelligencePanel
          selectedSentence={selectedSentence}
          book={activeBook}
          onClose={() => setIntelligenceEnabled(false)}
          onUpdateBook={(patch) => updateBook(activeBook.id, patch)}
          currentChapterId={activeChapter?.id ?? null}
        />
      )}

      {isMobile && activeBook && (
        <>
          {!intelligenceEnabled && (
            <button
              onClick={() => setIntelligenceEnabled(true)}
              className="fixed bottom-20 right-3 z-40 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg"
              aria-label="Open intelligence panel"
            >
              <Zap className="w-4 h-4" />
            </button>
          )}
          <Sheet open={intelligenceEnabled} onOpenChange={setIntelligenceEnabled}>
            <SheetContent side="right" className="w-[320px] p-0 bg-card border-l border-border">
              <IntelligencePanel
                selectedSentence={selectedSentence}
                book={activeBook}
                onClose={() => setIntelligenceEnabled(false)}
                className="w-full min-w-0 border-l-0"
                onUpdateBook={(patch) => updateBook(activeBook.id, patch)}
                currentChapterId={activeChapter?.id ?? null}
              />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};

export default Index;
