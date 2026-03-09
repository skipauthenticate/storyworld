import { Book } from "@/data/sampleBooks";
import { BookOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Switch } from "@/components/ui/switch";

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onImportEpub: (file: File, enrich: boolean) => void;
  importing: boolean;
}

export function WelcomeScreen({ books, onSelectBook, onImportEpub, importing }: WelcomeScreenProps) {
  const availableBooks = books.filter(b => b.chapters.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [enrichOnImport, setEnrichOnImport] = useState(true);

  const handleFile = (file: File) => {
    if (file.name.toLowerCase().endsWith(".epub")) {
      onImportEpub(file, enrichOnImport);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 relative">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>

      <div className="max-w-lg text-center">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif text-primary mb-3 tracking-wide">
          STORYWORLD
        </h2>
        <p className="text-muted-foreground text-[14px] sm:text-[15px] leading-relaxed mb-10">
          Where text comes alive. Select a book from your library to begin reading,
          or import an EPUB file.
        </p>

        {availableBooks.length > 0 && (
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
          </div>
        )}

        {/* EPUB Import */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50"
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".epub"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">
              {importing ? "Parsing EPUB…" : "Drop an EPUB here or click to import"}
            </p>
            <label className="flex items-center gap-1.5 mt-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={enrichOnImport}
                onCheckedChange={setEnrichOnImport}
                className="scale-75"
              />
              <span className="text-[11px] text-muted-foreground">Enrich on import</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
