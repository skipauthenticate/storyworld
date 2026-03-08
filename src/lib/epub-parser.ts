import ePub from "epubjs";
import type { Book, Chapter, Scene, Sentence } from "@/data/sampleBooks";

// Random cover colors for imported books
const COVER_COLORS = [
  "hsl(210, 45%, 42%)",
  "hsl(340, 40%, 45%)",
  "hsl(160, 35%, 40%)",
  "hsl(270, 35%, 45%)",
  "hsl(25, 50%, 42%)",
  "hsl(190, 40%, 38%)",
];

/**
 * Split text into sentences with smart handling of abbreviations,
 * dialogue quotes, and edge cases.
 */
function splitIntoSentences(text: string): string[] {
  // Common abbreviations that shouldn't trigger splits
  const abbrevs = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|inc|ltd|co|dept|approx|est|vol|no|fig)\./gi;
  
  // Temporarily replace abbreviation dots
  let processed = text.replace(abbrevs, (match) => match.replace(".", "<<DOT>>"));
  
  // Split on sentence-ending punctuation followed by space + uppercase or quote
  const parts = processed.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/);
  
  return parts
    .map((s) => s.replace(/<<DOT>>/g, ".").trim())
    .filter((s) => s.length > 20)
    .filter((s) => !/^(chapter\s+[\divxlc]+|table\s+of\s+contents|contents|§\s*\d+)$/i.test(s));
}

/**
 * Heuristically classify sentence type
 */
function classifySentence(text: string): Sentence["type"] {
  const trimmed = text.trim();
  // Dialogue: starts/contains quotes
  if (
    /^["'\u201C\u2018]/.test(trimmed) ||
    /^[A-Z][a-z]+ said/.test(trimmed) ||
    (trimmed.includes("\u201C") && trimmed.includes("\u201D")) ||
    (trimmed.includes('"') && trimmed.split('"').length >= 3)
  ) {
    return "dialogue";
  }
  // Description: starts with setting/location words
  if (
    /^(The (room|house|sky|sun|moon|light|dark|air|wind|sea|city|street|garden|forest)|It was a|There was|Outside|Inside|Above|Below|Beyond|Across)/i.test(
      trimmed
    )
  ) {
    return "description";
  }
  // Thought: contains thought indicators
  if (/^(I (thought|wondered|felt|knew|realized|imagined|supposed)|He thought|She thought)/i.test(trimmed)) {
    return "thought";
  }
  return "narration";
}

/**
 * Extract text content from XHTML/HTML string
 */
function extractText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  
  // Remove script and style elements
  div.querySelectorAll("script, style").forEach((el) => el.remove());
  
  // Get text with paragraph breaks preserved (avoid nested block duplication)
  const blocks: string[] = [];
  div.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, blockquote").forEach((el) => {
    const t = (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim();
    if (t) blocks.push(t);
  });

  // If no block elements found, fall back to full innerText
  if (blocks.length === 0) {
    return (div as HTMLElement).innerText?.trim() ?? "";
  }

  // De-duplicate repeated blocks (common in some EPUB DOM structures)
  const deduped = blocks.filter((block, idx) => {
    const normalized = block.toLowerCase();
    return idx === 0 || normalized !== blocks[idx - 1].toLowerCase();
  });

  return deduped.join("\n\n");
}

/**
 * Parse an EPUB file into our Book model
 */
export async function parseEpub(file: File): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  
  await book.ready;
  
  // Get metadata
  const metadata = book.packaging?.metadata;
  const title = metadata?.title || file.name.replace(/\.epub$/i, "");
  const author = metadata?.creator || "Unknown Author";
  
  // Get table of contents
  const nav = await book.loaded.navigation;
  const toc = nav?.toc ?? [];
  
  // Get spine items (ordered chapters)
  const spine = book.spine as any;
  const spineItems: any[] = [];
  
  if (spine?.each) {
    spine.each((item: any) => spineItems.push(item));
  } else if (spine?.items) {
    spineItems.push(...spine.items);
  }
  
  if (spineItems.length === 0) {
    throw new Error("Could not read book chapters. The EPUB may be malformed.");
  }
  
  // Build a set of TOC hrefs so we can identify the TOC spine item
  const tocHrefs = new Set(toc.map((t: any) => t.href?.split("#")[0]).filter(Boolean));

  const chapters: Chapter[] = [];
  let globalSentenceCount = 0;
  
  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    
    try {
      // Load chapter content
      const doc = await book.load(item.href);
      const html = doc instanceof Document 
        ? doc.documentElement.outerHTML 
        : typeof doc === "string" ? doc : "";
      
      const text = extractText(html);
      if (!text || text.length < 30) continue; // Skip very short/empty sections

      // Skip front-matter: TOC pages, title pages, copyright, etc.
      const textLower = text.toLowerCase();
      const hrefLower = (item.href || "").toLowerCase();

      // Detect TOC pages: high ratio of TOC entry labels in the text
      const tocLabelMatches = toc.filter((t: any) => t.label && text.includes(t.label.trim())).length;
      const isTocPage = toc.length > 3 && tocLabelMatches >= toc.length * 0.5;

      // Detect by href naming conventions
      const isFrontMatter = /\b(toc|table.?of.?contents|titlepage|title-page|copyright|cover|dedication|preface|foreword|frontmatter)\b/i.test(hrefLower);

      // Detect by content patterns (short text that's mostly navigation)
      const isNavContent = text.length < 500 && (
        /table\s+of\s+contents/i.test(textLower) ||
        /^\s*(cover|title\s+page|copyright|dedication)\s*$/im.test(textLower)
      );

      const legalPattern = /copyright\s*©|all\s+rights?\s+reserved|rights?\s+(of|to)\s+.*reproduc|this\s+publication\s+is\s+protected|non-exclusive|non-transferable|epubbooks|www\./i;
      const legalHitCount = (textLower.match(/copyright|all\s+rights?\s+reserved|non-transferable|publication\s+is\s+protected|epubbooks|www\./g) ?? []).length;
      const hasCopyrightContent = legalPattern.test(textLower);
      const startsWithLegal = legalPattern.test(textLower.slice(0, 1500));

      // Remove duplicated / legal front-matter paragraphs before chapter parsing
      const rawParagraphs = text
        .split(/\n\n+/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const uniqueParagraphs = rawParagraphs.filter((p, idx) => {
        const normalized = p.toLowerCase();
        return idx === rawParagraphs.findIndex((x) => x.toLowerCase() === normalized);
      });

      const contentParagraphs = uniqueParagraphs.filter((p) => !legalPattern.test(p.toLowerCase()));
      const cleanText = contentParagraphs.join("\n\n").trim();

      // Detect title pages: short sections where book title + author appear, but no narrative
      const isTitlePage = text.length < 1500 &&
        textLower.includes(title.toLowerCase()) &&
        textLower.includes(author.toLowerCase()) &&
        cleanText.length < 400;

      // Detect pure legal pages, including long duplicated ones
      const isCopyrightPage = (hasCopyrightContent && legalHitCount >= 2 && cleanText.length < 600) ||
        (startsWithLegal && legalHitCount >= 4 && cleanText.length < 1500);

      if (isTocPage || isFrontMatter || isNavContent || isCopyrightPage || isTitlePage) continue;
      if (!cleanText || cleanText.length < 80) continue;

      // Find TOC label for this spine item
      const tocEntry = toc.find(
        (t: any) => item.href?.includes(t.href?.split("#")[0])
      );
      const chapterTitle = tocEntry?.label?.trim() || `Chapter ${chapters.length + 1}`;
      
      // Split into sentences
      const sentenceTexts = splitIntoSentences(cleanText);
      if (sentenceTexts.length === 0) continue;
      
      const sentences: Sentence[] = sentenceTexts.map((s, sIdx) => ({
        id: `epub-${i}-${sIdx}`,
        text: s,
        type: classifySentence(s),
      }));
      
      globalSentenceCount += sentences.length;
      
      // Group into a single scene per chapter
      const scene: Scene = {
        id: `epub-scene-${i}`,
        title: chapterTitle,
        sentences,
      };
      
      chapters.push({
        id: `epub-ch-${i}`,
        number: chapters.length + 1,
        title: chapterTitle,
        scenes: [scene],
      });
    } catch (err) {
      console.warn(`[epub-parser] Skipping spine item ${i}:`, err);
      continue;
    }
  }
  
  if (chapters.length === 0) {
    throw new Error("No readable chapters found in this EPUB.");
  }
  
  const coverColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
  
  return {
    id: `epub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    author,
    year: 0,
    coverColor,
    chapters,
    characters: [],
    themes: [],
    progress: 0,
    totalSentences: globalSentenceCount,
  };
}
