import { Book, Chapter } from "@/data/sampleBooks";
import { BookOpen, ChevronRight, Menu, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LibrarySidebarProps {
  books: Book[];
  activeBook: Book | null;
  activeChapterId: string | null;
  onSelectBook: (book: Book) => void;
  onSelectChapter: (chapter: Chapter) => void;
  onImportEpub: (file: File) => void;
  onDeleteBook: (bookId: string) => void;
  importing: boolean;
}

function SidebarContent({
  books,
  activeBook,
  activeChapterId,
  onSelectBook,
  onSelectChapter,
  onImportEpub,
  onDeleteBook,
  importing,
  onItemClick,
}: LibrarySidebarProps & { onItemClick?: () => void }) {
  const [expandedBook, setExpandedBook] = useState<string | null>(activeBook?.id ?? null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Book library">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Library
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".epub"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.name.toLowerCase().endsWith(".epub")) {
                onImportEpub(file);
              }
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            title="Import EPUB"
            aria-label="Import EPUB file"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          {books.map((book) => (
            <div key={book.id} className="group">
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
                aria-current={activeBook?.id === book.id ? "true" : undefined}
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
                {book.id.startsWith("epub-") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: book.id, title: book.title });
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    aria-label={`Delete ${book.title}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
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
                          aria-current={activeChapterId === ch.id ? "page" : undefined}
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
      </nav>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove book</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.title}" from your library? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) onDeleteBook(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          aria-label="Open library menu"
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
