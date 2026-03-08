import { Book } from "@/data/sampleBooks";
import { BookOpen } from "lucide-react";

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
}

export function WelcomeScreen({ books, onSelectBook }: WelcomeScreenProps) {
  const availableBooks = books.filter(b => b.chapters.length > 0);
  const comingSoon = books.filter(b => b.chapters.length === 0);

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif text-primary mb-3 tracking-wide">
          STORYWORLD
        </h2>
        <p className="text-muted-foreground text-[14px] sm:text-[15px] leading-relaxed mb-10">
          Where text comes alive. Select a book from your library to begin reading,
          or explore the sample library.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {availableBooks.map((book) => (
            <button
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="group relative flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all"
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
            </button>
          ))}
          {comingSoon.map((book) => (
            <div
              key={book.id}
              className="relative flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card opacity-40"
            >
              <div
                className="w-16 h-24 rounded flex items-center justify-center shadow-lg"
                style={{ backgroundColor: book.coverColor }}
              >
                <BookOpen className="w-6 h-6 text-primary-foreground/80" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{book.title}</p>
                <p className="text-[10px] text-muted-foreground">{book.author}</p>
              </div>
              <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Coming Soon
              </span>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground/40 text-[11px] font-mono">
          EPUB &amp; PDF import — coming soon
        </p>
      </div>
    </div>
  );
}
