import { Book } from "@/data/sampleBooks";
import { BookOpen } from "lucide-react";

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
}

export function WelcomeScreen({ books, onSelectBook }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-lg text-center px-8">
        <h2 className="text-4xl font-bold font-serif text-gold mb-3 tracking-wide">
          STORYWORLD
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed mb-10">
          Where text comes alive. Select a book from your library to begin reading,
          or explore the sample library.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => book.chapters.length > 0 && onSelectBook(book)}
              disabled={book.chapters.length === 0}
              className="group relative flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 hover:glow-gold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div
                className="w-16 h-24 rounded flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
                style={{ backgroundColor: book.coverColor }}
              >
                <BookOpen className="w-6 h-6 text-primary-foreground/80" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{book.title}</p>
                <p className="text-[10px] text-muted-foreground">{book.author}</p>
              </div>
              {book.chapters.length === 0 && (
                <span className="absolute top-2 right-2 text-[8px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Coming Soon
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Coming soon hint */}
        <p className="text-muted-foreground/40 text-[11px] font-mono">
          EPUB &amp; PDF import — coming soon
        </p>
      </div>
    </div>
  );
}
