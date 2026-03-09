import { Sentence } from "@/data/sampleBooks";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface SentenceRendererProps {
  sentence: Sentence;
  index: number;
  activeSentenceIndex: number;
  isPlaying: boolean;
  voiceEnabled: boolean;
  onSelect: (sentence: Sentence) => void;
}

function getHighlightClass(sentence: Sentence): string {
  switch (sentence.type) {
    case "dialogue": return "highlight-dialogue";
    case "description": return "highlight-theme";
    case "thought": return "highlight-emotion";
    default: return "highlight-narration";
  }
}

function getStateClass(index: number, activeIndex: number, isPlaying: boolean): string {
  if (!isPlaying) return "sentence-active";
  if (index === activeIndex) return "sentence-active";
  if (index < activeIndex) return "sentence-dim";
  return "sentence-future";
}

export const SentenceRenderer = forwardRef<HTMLSpanElement, SentenceRendererProps>(
  function SentenceRenderer(
    { sentence, index, activeSentenceIndex, isPlaying, voiceEnabled, onSelect },
    ref
  ) {
    const isActive = index === activeSentenceIndex && isPlaying;
    const showHighlight = voiceEnabled && isActive;

    const hasAnnotation = !!sentence.annotation;

    return (
      <span
        ref={ref}
        data-sentence="true"
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "cursor-pointer transition-all duration-400 rounded-sm px-0.5 -mx-0.5 inline",
          getStateClass(index, activeSentenceIndex, isPlaying),
          showHighlight && getHighlightClass(sentence),
          isActive && "animate-sentence-glow",
          !isActive && "hover:bg-muted/30",
          !isActive && hasAnnotation && "border-b border-dotted border-primary/20",
          sentence.type === "dialogue" && "italic"
        )}
        onClick={() => onSelect(sentence)}
        title={hasAnnotation ? "Annotated — click to view" : undefined}
      >
        {sentence.text}{" "}
      </span>
    );
  }
);
