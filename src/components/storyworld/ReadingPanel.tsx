import { Chapter, Sentence } from "@/data/sampleBooks";
import { SentenceRenderer } from "./SentenceRenderer";
import { useEffect, useRef, useMemo } from "react";

interface ReadingPanelProps {
  chapter: Chapter;
  activeSentenceIndex: number;
  isPlaying: boolean;
  readingMode: "classic" | "narrated" | "immersive";
  onSelectSentence: (sentence: Sentence) => void;
}

export function ReadingPanel({
  chapter,
  activeSentenceIndex,
  isPlaying,
  readingMode,
  onSelectSentence,
}: ReadingPanelProps) {
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  // Pre-compute sentence-to-global-index mapping
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

  // Auto-scroll to active sentence during narration
  useEffect(() => {
    if (isPlaying && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSentenceIndex, isPlaying]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[680px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Chapter Title */}
        <h2 className="text-2xl sm:text-[28px] font-bold font-serif text-primary mb-8 tracking-wide">
          {chapter.title}
        </h2>

        {chapter.scenes.map((scene, sceneIdx) => (
          <div key={scene.id} className="mb-10">
            {/* Scene Divider */}
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

            {/* Sentences as flowing paragraphs */}
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
                    readingMode={readingMode}
                    onSelect={onSelectSentence}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Bottom spacer */}
        <div className="h-32" />
      </div>
    </div>
  );
}
