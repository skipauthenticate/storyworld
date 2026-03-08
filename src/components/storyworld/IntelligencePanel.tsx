import { Sentence, Character, Book } from "@/data/sampleBooks";
import { X, BookOpen, MessageSquare, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface IntelligencePanelProps {
  selectedSentence: Sentence | null;
  book: Book;
  showCharacters: boolean;
  onClose: () => void;
  onCloseCharacters: () => void;
}

export function IntelligencePanel({
  selectedSentence,
  book,
  showCharacters,
  onClose,
  onCloseCharacters,
}: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<"annotation" | "characters" | "themes">(
    showCharacters ? "characters" : "annotation"
  );

  // Sync tab when showCharacters prop changes
  if (showCharacters && activeTab !== "characters") {
    setActiveTab("characters");
  }

  const tabs = [
    { id: "annotation" as const, label: "Annotation", icon: BookOpen },
    { id: "characters" as const, label: "Characters", icon: User },
    { id: "themes" as const, label: "Themes", icon: Sparkles },
  ];

  return (
    <aside className="w-[340px] min-w-[340px] h-screen flex flex-col border-l border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Intelligence
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-mono transition-colors border-b-2",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === "annotation" && (
            <motion.div
              key="annotation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {selectedSentence ? (
                <div className="space-y-4">
                  {/* Selected sentence */}
                  <div className="p-3 rounded bg-muted/50 border border-border">
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
                      Selected Passage
                    </p>
                    <p className="text-[14px] leading-relaxed italic text-foreground/90">
                      "{selectedSentence.text}"
                    </p>
                    {selectedSentence.speaker && (
                      <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                        — {selectedSentence.speaker}
                      </p>
                    )}
                  </div>

                  {/* Type & Emotion badges */}
                  <div className="flex gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {selectedSentence.type}
                    </span>
                    {selectedSentence.emotion && (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sw-rose/10 text-sw-rose">
                        {selectedSentence.emotion}
                      </span>
                    )}
                  </div>

                  {/* Annotation */}
                  {selectedSentence.annotation && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />
                        Literary Analysis
                      </p>
                      <p className="text-[14px] leading-[1.7] text-foreground/85">
                        {selectedSentence.annotation}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Tap any sentence to see its annotation
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Literary analysis, character insights, and cross-references
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "characters" && (
            <motion.div
              key="characters"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {book.characters.map((char) => (
                <div
                  key={char.id}
                  className="p-3 rounded border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: char.color }}
                    />
                    <span className="text-[14px] font-semibold">{char.name}</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {char.description}
                  </p>
                  {char.appearances.length > 0 && (
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
                      Appears in Ch. {char.appearances.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "themes" && (
            <motion.div
              key="themes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Major Themes
              </p>
              {book.themes.map((theme, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[13px]">{theme}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Q&A Input (Immersive mode teaser) */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/50 border border-border">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ask about this passage..."
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
      </div>
    </aside>
  );
}
