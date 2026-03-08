import { Book, Chapter } from "@/data/sampleBooks";
import { BookOpen, ChevronRight, Users, Sparkles, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface LibrarySidebarProps {
  books: Book[];
  activeBook: Book | null;
  activeChapterId: string | null;
  onSelectBook: (book: Book) => void;
  onSelectChapter: (chapter: Chapter) => void;
  onShowCharacters: () => void;
  onShowThemes?: () => void;
}

function SidebarContent({
  books,
  activeBook,
  activeChapterId,
  onSelectBook,
  onSelectChapter,
  onShowCharacters,
  onShowThemes,
  onItemClick,
}: LibrarySidebarProps & { onItemClick?: () => void }) {
  const [expandedBook, setExpandedBook] = useState<string | null>(activeBook?.id ?? null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-wide text-primary font-serif">
          STORYWORLD
        </h1>
        <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
          Where text comes alive
        </p>
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
                  if (book.chapters.length > 0) onItemClick?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors",
                  activeBook?.id === book.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  book.chapters.length === 0 && "opacity-50 cursor-not-allowed"
                )}
                disabled={book.chapters.length === 0}
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
                {book.chapters.length > 0 ? (
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 text-muted-foreground transition-transform",
                      expandedBook === book.id && "rotate-90"
                    )}
                  />
                ) : (
                  <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Soon
                  </span>
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
                          onClick={() => {
                            onSelectChapter(ch);
                            onItemClick?.();
                          }}
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
            onClick={() => { onShowCharacters(); onItemClick?.(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Characters</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{activeBook.characters.length}</span>
          </button>
          <button
            onClick={() => { onShowThemes?.(); onItemClick?.(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Themes</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{activeBook.themes.length}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function LibrarySidebar(props: LibrarySidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border border-border text-foreground shadow-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-r border-border">
            <SidebarContent {...props} onItemClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="w-[240px] min-w-[240px] h-screen flex flex-col border-r border-border bg-sidebar overflow-hidden">
      <SidebarContent {...props} />
    </aside>
  );
}
