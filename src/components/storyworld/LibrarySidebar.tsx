import { Book, Chapter } from "@/data/sampleBooks";
import { BookOpen, ChevronRight, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type ReadingMode = "classic" | "narrated" | "immersive";

interface LibrarySidebarProps {
  books: Book[];
  activeBook: Book | null;
  activeChapterId: string | null;
  readingMode: ReadingMode;
  onSelectBook: (book: Book) => void;
  onSelectChapter: (chapter: Chapter) => void;
  onSetMode: (mode: ReadingMode) => void;
  onShowCharacters: () => void;
  onShowThemes?: () => void;
}

const modeConfig = {
  classic: { label: "Classic", description: "Pure text", icon: "📖" },
  narrated: { label: "Narrated", description: "Text + Voice", icon: "🎧" },
  immersive: { label: "Immersive", description: "Text + Voice + AI", icon: "✨" },
};

export function LibrarySidebar({
  books,
  activeBook,
  activeChapterId,
  readingMode,
  onSelectBook,
  onSelectChapter,
  onSetMode,
  onShowCharacters,
  onShowThemes,
}: LibrarySidebarProps) {
  const [expandedBook, setExpandedBook] = useState<string | null>(activeBook?.id ?? null);

  return (
    <aside className="w-[240px] min-w-[240px] h-screen flex flex-col border-r border-border bg-sidebar overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-wide text-gold font-serif">
          STORYWORLD
        </h1>
        <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
          Where text comes alive
        </p>
      </div>

      {/* Mode Selector */}
      <div className="px-3 py-3 border-b border-border">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">
          Reading Mode
        </p>
        <div className="space-y-1">
          {(Object.keys(modeConfig) as ReadingMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onSetMode(mode)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-sm",
                readingMode === mode
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <span className="text-base">{modeConfig[mode].icon}</span>
              <div>
                <div className="font-medium text-[13px]">{modeConfig[mode].label}</div>
                <div className="text-[10px] text-muted-foreground">{modeConfig[mode].description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Library */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">
          Library
        </p>
        <div className="space-y-1">
          {books.map((book) => (
            <div key={book.id}>
              <button
                onClick={() => {
                  onSelectBook(book);
                  setExpandedBook(expandedBook === book.id ? null : book.id);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors",
                  activeBook?.id === book.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div
                  className="w-6 h-8 rounded-sm flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: book.coverColor }}
                >
                  <BookOpen className="w-3 h-3 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{book.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{book.author}</div>
                </div>
                {book.chapters.length > 0 && (
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 text-muted-foreground transition-transform",
                      expandedBook === book.id && "rotate-90"
                    )}
                  />
                )}
              </button>

              {/* Chapters */}
              <AnimatePresence>
                {expandedBook === book.id && book.chapters.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-3 border-l border-border space-y-0.5 py-1">
                      {book.chapters.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => onSelectChapter(ch)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded text-[12px] transition-colors",
                            activeChapterId === ch.id
                              ? "text-primary bg-primary/5"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {ch.title}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      {activeBook && activeBook.characters.length > 0 && (
        <div className="px-3 py-3 border-t border-border space-y-1">
          <button
            onClick={onShowCharacters}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Characters</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{activeBook.characters.length}</span>
          </button>
          <button
            onClick={onShowThemes}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Themes</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{activeBook.themes.length}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
