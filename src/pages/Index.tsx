import { useState, useCallback, useEffect, useRef } from "react";
import { sampleBooks, Book, Chapter, Sentence } from "@/data/sampleBooks";
import { LibrarySidebar } from "@/components/storyworld/LibrarySidebar";
import { ReadingPanel } from "@/components/storyworld/ReadingPanel";
import { NarrationControls } from "@/components/storyworld/NarrationControls";
import { IntelligencePanel } from "@/components/storyworld/IntelligencePanel";
import { WelcomeScreen } from "@/components/storyworld/WelcomeScreen";

type ReadingMode = "classic" | "narrated" | "immersive";

const Index = () => {
  const [books] = useState<Book[]>(sampleBooks);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [readingMode, setReadingMode] = useState<ReadingMode>("immersive");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(null);
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [showCharacters, setShowCharacters] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get all sentences in current chapter
  const allSentences = activeChapter?.scenes.flatMap((s) => s.sentences) ?? [];

  // Auto-advance narration
  useEffect(() => {
    if (isPlaying && readingMode !== "classic" && allSentences.length > 0) {
      intervalRef.current = setInterval(() => {
        setActiveSentenceIndex((prev) => {
          if (prev >= allSentences.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, readingMode, allSentences.length]);

  const handleSelectBook = useCallback((book: Book) => {
    setActiveBook(book);
    if (book.chapters.length > 0) {
      setActiveChapter(book.chapters[0]);
      setActiveSentenceIndex(0);
      setIsPlaying(false);
      setSelectedSentence(null);
    }
  }, []);

  const handleSelectChapter = useCallback((chapter: Chapter) => {
    setActiveChapter(chapter);
    setActiveSentenceIndex(0);
    setIsPlaying(false);
    setSelectedSentence(null);
  }, []);

  const handleSelectSentence = useCallback((sentence: Sentence) => {
    setSelectedSentence(sentence);
    const idx = allSentences.findIndex((s) => s.id === sentence.id);
    if (idx >= 0) setActiveSentenceIndex(idx);
    if (readingMode === "immersive") setShowIntelligence(true);
  }, [allSentences, readingMode]);

  const handleTogglePlay = useCallback(() => {
    if (readingMode === "classic") {
      setReadingMode("narrated");
    }
    setIsPlaying((prev) => !prev);
  }, [readingMode]);

  const handlePrevious = useCallback(() => {
    setActiveSentenceIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setActiveSentenceIndex((prev) => Math.min(allSentences.length - 1, prev + 1));
  }, [allSentences.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
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
  }, [handleTogglePlay, handlePrevious, handleNext]);

  const showNarrationBar = readingMode !== "classic" && activeChapter;
  const showRightPanel = readingMode === "immersive" && showIntelligence && activeBook;

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
          setShowIntelligence(true);
        }}
      />

      {/* Main content */}
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
                onTogglePlay={handleTogglePlay}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onSpeedChange={setSpeed}
              />
            )}
          </>
        ) : (
          <WelcomeScreen books={books} onSelectBook={handleSelectBook} />
        )}
      </div>

      {/* Intelligence Panel */}
      {showRightPanel && activeBook && (
        <IntelligencePanel
          selectedSentence={selectedSentence}
          book={activeBook}
          showCharacters={showCharacters}
          onClose={() => setShowIntelligence(false)}
          onCloseCharacters={() => setShowCharacters(false)}
        />
      )}
    </div>
  );
};

export default Index;
