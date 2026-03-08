import { Sentence } from "@/data/sampleBooks";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { forwardRef } from "react";

interface SentenceRendererProps {
  sentence: Sentence;
  index: number;
  activeSentenceIndex: number;
  isPlaying: boolean;
  readingMode: "classic" | "narrated" | "immersive";
  onSelect: (sentence: Sentence) => void;
}

function getHighlightClass(sentence: Sentence): string {
  switch (sentence.type) {
    case "dialogue":
      return "highlight-dialogue";
    case "description":
      return "highlight-theme";
    case "thought":
      return "highlight-emotion";
    default:
      return "highlight-narration";
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
    { sentence, index, activeSentenceIndex, isPlaying, readingMode, onSelect },
    ref
  ) {
    const isActive = index === activeSentenceIndex && isPlaying;
    const showHighlight = readingMode !== "classic" && isActive;

    return (
      <motion.span
        ref={ref}
        layout
        className={cn(
          "cursor-pointer transition-all duration-400 rounded-sm px-0.5 -mx-0.5 inline",
          getStateClass(index, activeSentenceIndex, isPlaying),
          showHighlight && getHighlightClass(sentence),
          isActive && "animate-sentence-glow",
          !isActive && "hover:bg-muted/30",
          sentence.type === "dialogue" && "italic"
        )}
        onClick={() => onSelect(sentence)}
      >
        {sentence.text}{" "}
      </motion.span>
    );
  }
);
