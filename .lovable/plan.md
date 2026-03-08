

## Plan: Navigation, EPUB Import, and End-to-End Testing

### 1. Back to Library Navigation

Currently there's no way to leave a book and return to the welcome/dashboard screen.

**Changes:**
- **ReadingPanel**: Add a top bar with book title, chapter name, and a "Back to Library" button (Home or ArrowLeft icon)
- **NarrationControls**: Add prev/next chapter buttons flanking the chapter indicator (e.g., "Chapter I · 1/2" with left/right arrows)
- **Index.tsx**: Add `handleBackToLibrary` (sets activeBook/activeChapter to null) and `handleNextChapter`/`handlePrevChapter` callbacks

### 2. EPUB Import

Add real EPUB file upload and parsing. EPUBs are ZIP archives containing XHTML chapters + OPF metadata.

**New dependency:** `epubjs` — mature browser-based EPUB parser with spine navigation, TOC extraction, and content rendering.

**New files:**
- `src/lib/epub-parser.ts` — Takes a File/ArrayBuffer, uses epubjs to extract:
  - Book metadata (title, author, cover color from CSS or fallback)
  - Chapters from spine/TOC
  - For each chapter: extract text nodes, split into sentences (regex split on `.!?` with smart handling of abbreviations/quotes), assign sentence types heuristically (dialogue if wrapped in quotes, description if starts with setting words, narration otherwise)
  - Characters/themes left empty (to be populated by autoresearch later)
  - Returns a `Book` object matching existing interface

**UI changes:**
- **WelcomeScreen**: Replace "EPUB & PDF import — coming soon" with an "Import EPUB" drop zone / file picker button
- **LibrarySidebar**: Add a small "+" button next to "Library" header to upload from sidebar
- **Index.tsx**: Manage `books` as mutable state (`setBooks`), append parsed books on import

**Storage:** Uploaded books stored in component state for now. Optionally persist to localStorage (serialized Book JSON) so they survive refresh.

### 3. Chapter Navigation in Reading View

- **ReadingPanel top bar**: `← Library | Book Title | Chapter Title (1/N) ▸`
- **End of chapter**: After the last sentence, show a "Continue to Chapter N+1 →" prompt
- **NarrationControls**: Show chapter indicator with prev/next chapter arrows

### 4. End-to-End Testing with Real EPUBs

After implementation, I'll:
- Download 2-3 public domain EPUBs from Project Gutenberg (e.g., *Pride and Prejudice*, *Alice in Wonderland*)
- Upload them via the new import UI in the browser
- Verify: metadata extraction, chapter list in sidebar, sentence rendering, narration playback, intelligence panel context

### Files Modified
- `src/pages/Index.tsx` — mutable books state, back/chapter nav handlers, import handler
- `src/components/storyworld/WelcomeScreen.tsx` — import button/drop zone
- `src/components/storyworld/LibrarySidebar.tsx` — "+" upload button
- `src/components/storyworld/ReadingPanel.tsx` — top nav bar, end-of-chapter prompt
- `src/components/storyworld/NarrationControls.tsx` — chapter indicator with prev/next

### New Files
- `src/lib/epub-parser.ts` — EPUB → Book model conversion

### New Dependency
- `epubjs`

