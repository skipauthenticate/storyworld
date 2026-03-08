import { useState, useCallback, useEffect } from "react";
import { sampleBooks, Book, Chapter, Sentence } from "@/data/sampleBooks";
import { LibrarySidebar } from "@/components/storyworld/LibrarySidebar";
import { ReadingPanel } from "@/components/storyworld/ReadingPanel";
import { NarrationControls } from "@/components/storyworld/NarrationControls";
import { IntelligencePanel } from "@/components/storyworld/IntelligencePanel";
import { WelcomeScreen } from "@/components/storyworld/WelcomeScreen";
import { KeyboardHints } from "@/components/storyworld/KeyboardHints";
import { useNarration } from "@/hooks/useNarration";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Brain } from "lucide-react";
import { ThemeToggle } from "@/components/storyworld/ThemeToggle";

type ReadingMode = "classic" | "narrated" | "immersive";

const Index = () => {
  const [books] = useState<Book[]>(sampleBooks);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [readingMode, setReadingMode] = useState<ReadingMode>("immersive");
  const [speed, setSpeed] = useState(1.0);
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(null);
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [showCharacters, setShowCharacters] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const isMobile = useIsMobile();

  const allSentences = activeChapter?.scenes.flatMap((s) => s.sentences) ?? [];

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
    reset: resetNarration,
  } = useNarration({
    sentences: allSentences,
    speed,
    readingMode,
  });

  const { save: saveProgress, load: loadProgress } = useReadingProgress(
    activeBook?.id ?? null,
    activeChapter?.id ?? null
  );

  // Save progress as narration advances
  useEffect(() => {
    if (activeBook && activeChapter) {
      saveProgress(activeSentenceIndex);
    }
  }, [activeSentenceIndex, activeBook, activeChapter, saveProgress]);

  // Restore progress on initial load
  useEffect(() => {
    const progress = loadProgress();
    if (progress) {
      const book = books.find((b) => b.id === progress.bookId);
      if (book && book.chapters.length > 0) {
        setActiveBook(book);
        const chapter = book.chapters.find((c) => c.id === progress.chapterId);
        setActiveChapter(chapter ?? book.chapters[0]);
      }
    }
  }, []);

  useEffect(() => {
    setNarrationSpeed(speed);
  }, [speed, setNarrationSpeed]);

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
  }, []);

  const handleSelectSentence = useCallback((sentence: Sentence) => {
    setSelectedSentence(sentence);
    const idx = allSentences.findIndex((s) => s.id === sentence.id);
    if (idx >= 0) goToSentence(idx);
    if (readingMode === "immersive") setShowIntelligence(true);
  }, [allSentences, readingMode, goToSentence]);

  const handleTogglePlay = useCallback(() => {
    if (readingMode === "classic") {
      setReadingMode("narrated");
    }
    togglePlay();
  }, [readingMode, togglePlay]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        case "1":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); setReadingMode("classic"); }
          break;
        case "2":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); setReadingMode("narrated"); }
          break;
        case "3":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); setReadingMode("immersive"); }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay, goToPrevious, goToNext]);

  const showNarrationBar = readingMode !== "classic" && activeChapter;
  const showRightPanel = readingMode === "immersive" && showIntelligence && activeBook;

  // Compute dynamic progress
  const dynamicProgress = allSentences.length > 0
    ? Math.round((activeSentenceIndex / allSentences.length) * 100)
    : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <LibrarySidebar
        books={books}
        activeBook={activeBook}
        activeChapterId={activeChapter?.id ?? null}
        readingMode={readingMode}
        onSelectBook={handleSelectBook}
        onSelectChapter={handleSelectChapter}
        onSetMode={setReadingMode}
        onShowCharacters={() => {
          setShowCharacters(true);
          setShowThemes(false);
          setShowIntelligence(true);
        }}
        onShowThemes={() => {
          setShowThemes(true);
          setShowCharacters(false);
          setShowIntelligence(true);
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeChapter ? (
          <>
            <ReadingPanel
              chapter={activeChapter}
              activeSentenceIndex={activeSentenceIndex}
              isPlaying={isPlaying}
              readingMode={readingMode}
              onSelectSentence={handleSelectSentence}
            />
            {showNarrationBar && (
              <NarrationControls
                isPlaying={isPlaying}
                speed={speed}
                currentSentence={activeSentenceIndex}
                totalSentences={allSentences.length}
                ttsEngine={ttsEngine}
                ttsLoading={ttsLoading}
                onTogglePlay={handleTogglePlay}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onSpeedChange={setSpeed}
              />
            )}
          </>
        ) : (
          <WelcomeScreen books={books} onSelectBook={handleSelectBook} />
        )}
      </div>

      {/* Intelligence Panel — desktop sidebar or mobile sheet */}
      {showRightPanel && activeBook && !isMobile && (
        <IntelligencePanel
          selectedSentence={selectedSentence}
          book={activeBook}
          showCharacters={showCharacters}
          showThemes={showThemes}
          onClose={() => setShowIntelligence(false)}
          onCloseCharacters={() => setShowCharacters(false)}
          onCloseThemes={() => setShowThemes(false)}
        />
      )}

      {isMobile && activeBook && readingMode === "immersive" && (
        <>
          <button
            onClick={() => setShowIntelligence(true)}
            className="fixed bottom-20 right-3 z-40 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <Brain className="w-4 h-4" />
          </button>
          <Sheet open={showIntelligence} onOpenChange={setShowIntelligence}>
            <SheetContent side="right" className="w-[320px] p-0 bg-card border-l border-border">
              <IntelligencePanel
                selectedSentence={selectedSentence}
                book={activeBook}
                showCharacters={showCharacters}
                showThemes={showThemes}
                onClose={() => setShowIntelligence(false)}
                onCloseCharacters={() => setShowCharacters(false)}
                onCloseThemes={() => setShowThemes(false)}
                className="w-full min-w-0 border-l-0"
              />
            </SheetContent>
          </Sheet>
        </>
      )}

      <KeyboardHints />
    </div>
  );
};

export default Index;
