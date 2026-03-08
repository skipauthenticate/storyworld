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
import { useAutoResearch } from "@/hooks/useAutoResearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Brain } from "lucide-react";
import { ThemeToggle } from "@/components/storyworld/ThemeToggle";

const Index = () => {
  const [books] = useState<Book[]>(sampleBooks);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(null);
  const isMobile = useIsMobile();

  const allSentences = activeChapter?.scenes.flatMap((s) => s.sentences) ?? [];

  const { triggerImprovement } = useAutoResearch();

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
  });

  const { save: saveProgress, load: loadProgress } = useReadingProgress(
    activeBook?.id ?? null,
    activeChapter?.id ?? null
  );

  useEffect(() => {
    if (activeBook && activeChapter) {
      saveProgress(activeSentenceIndex);
    }
  }, [activeSentenceIndex, activeBook, activeChapter, saveProgress]);

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
    triggerImprovement("annotations");
  }, [triggerImprovement]);

  const handleSelectSentence = useCallback((sentence: Sentence) => {
    setSelectedSentence(sentence);
    const idx = allSentences.findIndex((s) => s.id === sentence.id);
    if (idx >= 0) goToSentence(idx);
    triggerImprovement("annotations");
  }, [allSentences, goToSentence, triggerImprovement]);

  const handleTogglePlay = useCallback(() => {
    if (!voiceEnabled) setVoiceEnabled(true);
    togglePlay();
  }, [voiceEnabled, togglePlay]);

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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay, goToPrevious, goToNext]);

  const showRightPanel = intelligenceEnabled && activeBook;

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
      />

      <div id="main-content" className="flex-1 flex flex-col overflow-hidden">
        {activeChapter ? (
          <>
            <ReadingPanel
              chapter={activeChapter}
              activeSentenceIndex={activeSentenceIndex}
              isPlaying={isPlaying}
              voiceEnabled={voiceEnabled}
              onSelectSentence={handleSelectSentence}
            />
            <NarrationControls
              isPlaying={isPlaying}
              speed={speed}
              currentSentence={activeSentenceIndex}
              totalSentences={allSentences.length}
              ttsEngine={ttsEngine}
              ttsLoading={ttsLoading}
              voiceEnabled={voiceEnabled}
              intelligenceEnabled={intelligenceEnabled}
              onTogglePlay={handleTogglePlay}
              onPrevious={goToPrevious}
              onNext={goToNext}
              onSpeedChange={setSpeed}
              onToggleVoice={() => setVoiceEnabled((v) => !v)}
              onToggleIntelligence={() => setIntelligenceEnabled((v) => !v)}
            />
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
          onClose={() => setIntelligenceEnabled(false)}
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
              <Brain className="w-4 h-4" />
            </button>
          )}
          <Sheet open={intelligenceEnabled} onOpenChange={setIntelligenceEnabled}>
            <SheetContent side="right" className="w-[320px] p-0 bg-card border-l border-border">
              <IntelligencePanel
                selectedSentence={selectedSentence}
                book={activeBook}
                onClose={() => setIntelligenceEnabled(false)}
                className="w-full min-w-0 border-l-0"
              />
            </SheetContent>
          </Sheet>
        </>
      )}

      <KeyboardHints />
      <ThemeToggle />
    </div>
  );
};

export default Index;
