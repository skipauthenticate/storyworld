/**
 * Progressive enrichment queue with priority scheduling.
 * Processes book-level metadata first, then chapter annotations in priority order.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { Book, Chapter, Character } from "@/data/sampleBooks";
import {
  initLLM,
  chatGenerate,
  onLLMStateChange,
  getLLMState,
  type LLMEngineStatus,
} from "@/lib/llm-engine";
import {
  type EnrichmentQueueState,
  type ChapterEnrichment,
  loadQueueState,
  saveQueueState,
  createInitialQueueState,
} from "@/lib/enrichment-storage";

// ── Constants ──

const CHARACTER_COLORS = [
  "hsl(210, 50%, 55%)", "hsl(40, 60%, 50%)", "hsl(120, 30%, 55%)",
  "hsl(0, 40%, 50%)", "hsl(270, 40%, 55%)", "hsl(180, 40%, 50%)",
  "hsl(330, 45%, 55%)", "hsl(60, 45%, 45%)",
];

const ANNOTATION_BATCH_SIZE = 6;

/** Yield to the browser's event loop so it can paint / handle input */
const yieldToMain = (): Promise<void> => new Promise(r => setTimeout(r, 0));

// ── Helpers ──

function extractChapterText(chapter: Chapter, maxChars = 2000): string {
  const lines: string[] = [];
  let chars = 0;
  for (const sc of chapter.scenes) {
    for (const s of sc.sentences) {
      if (chars + s.text.length > maxChars) return lines.join("\n");
      lines.push(s.text);
      chars += s.text.length;
    }
  }
  return lines.join("\n");
}

function tryParseJSON(text: string): any | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/[\[{][\s\S]*?[\]}]/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

// ── Types ──

export type QueuePhase = "idle" | "init-llm" | "global-analysis" | "chapter-processing" | "completed" | "error";

export interface EnrichmentQueueHook {
  phase: QueuePhase;
  queueState: EnrichmentQueueState | null;
  llmStatus: LLMEngineStatus;
  llmProgress: number;
  error: string | null;
  /** Start or resume enrichment for a book */
  startEnrichment: (book: Book) => void;
  /** Update the reading chapter so priority adjusts */
  setReadingChapter: (chapterId: string) => void;
  /** Cancel processing */
  cancel: () => void;
}

export function useEnrichmentQueue(
  onBookUpdate: (patch: Partial<Book>) => void
): EnrichmentQueueHook {
  const [phase, setPhase] = useState<QueuePhase>("idle");
  const [queueState, setQueueState] = useState<EnrichmentQueueState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMEngineStatus>(getLLMState().status);
  const [llmProgress, setLlmProgress] = useState(getLLMState().progress);

  const abortRef = useRef(false);
  const readingChapterRef = useRef<string | null>(null);
  const bookRef = useRef<Book | null>(null);
  const runningRef = useRef(false);

  const setReadingChapter = useCallback((chapterId: string) => {
    readingChapterRef.current = chapterId;
  }, []);

  // Persist and update state atomically
  const updateQueue = useCallback(
    async (updater: (prev: EnrichmentQueueState) => EnrichmentQueueState) => {
      setQueueState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        // fire-and-forget persist
        saveQueueState(next).catch(() => {});
        return next;
      });
    },
    []
  );

  // ── Global analysis: characters + themes from first 3 chapters ──

  const runGlobalAnalysis = useCallback(
    async (book: Book): Promise<{ characters: Character[]; themes: string[] }> => {
      const sampleChapters = book.chapters.slice(0, 3);
      const sample = sampleChapters.map((ch) => extractChapterText(ch, 1200)).join("\n\n");

      // Characters
      const charPrompt = `Analyze this excerpt from "${book.title}" by ${book.author}. Identify the main characters (up to 6). Return ONLY a JSON array of objects with "name" and "description" fields. Example: [{"name":"Jay Gatsby","description":"A mysterious millionaire."}]\n\nText:\n${sample}`;

      const charResp = await chatGenerate(
        [{ role: "user", content: charPrompt }],
        { maxTokens: 400, temperature: 0.3 }
      );
      if (abortRef.current) return { characters: [], themes: [] };

      let characters: Character[] = [];
      const charData = tryParseJSON(charResp);
      if (Array.isArray(charData)) {
        characters = charData
          .filter((c: any) => c?.name && typeof c.name === "string")
          .slice(0, 6)
          .map((c: any, i: number) => ({
            id: `char-${i}-${Date.now()}`,
            name: String(c.name).trim(),
            description: String(c.description || "").trim(),
            color: CHARACTER_COLORS[i % CHARACTER_COLORS.length],
            appearances: [],
          }));
      }

      if (abortRef.current) return { characters, themes: [] };

      await yieldToMain();

      // Themes
      const themePrompt = `What are the major themes in "${book.title}" by ${book.author}? Return ONLY a JSON array of short theme strings (3-6 words each), up to 6 themes. Example: ["The American Dream","Class and social mobility"]\n\nText:\n${sample.substring(0, 1500)}`;

      const themeResp = await chatGenerate(
        [{ role: "user", content: themePrompt }],
        { maxTokens: 200, temperature: 0.3 }
      );
      if (abortRef.current) return { characters, themes: [] };

      let themes: string[] = [];
      const themeData = tryParseJSON(themeResp);
      if (Array.isArray(themeData)) {
        themes = themeData.filter((t: any) => typeof t === "string").slice(0, 6).map((t: string) => t.trim());
      }

      return { characters, themes };
    },
    []
  );

  // ── Annotate one chapter in batches ──

  const annotateChapter = useCallback(
    async (book: Book, chapter: Chapter, existingAnnotations: Record<string, string>) => {
      const allSentences = chapter.scenes.flatMap((s) => s.sentences);
      // Skip already-annotated sentences
      const unannotated = allSentences.filter(
        (s) => !existingAnnotations[s.id] && !s.annotation
      );
      if (unannotated.length === 0) return existingAnnotations;

      const annotations = { ...existingAnnotations };

      let batchCount = 0;
      for (let i = 0; i < unannotated.length; i += ANNOTATION_BATCH_SIZE) {
        if (abortRef.current) break;

        // Yield between batches so the UI stays responsive
        await yieldToMain();

        const batch = unannotated.slice(i, i + ANNOTATION_BATCH_SIZE);
        const sentTexts = batch.map((s, j) => `[${j}] ${s.text}`).join("\n");

        const prompt = `You are a literary analyst. For each numbered sentence below from "${book.title}", write a brief annotation (1-2 sentences) about its literary significance. Return ONLY a JSON array of strings, one annotation per sentence in order.\n\n${sentTexts}`;

        try {
          const resp = await chatGenerate(
            [{ role: "user", content: prompt }],
            { maxTokens: 512, temperature: 0.4 }
          );

          const parsed = tryParseJSON(resp);
          if (Array.isArray(parsed)) {
            batch.forEach((sent, j) => {
              if (j < parsed.length && typeof parsed[j] === "string") {
                annotations[sent.id] = parsed[j];
              }
            });
          }
        } catch (err) {
          console.warn("[EnrichmentQueue] Batch annotation error:", err);
          // Continue with next batch
        }

        batchCount++;

        // Progressive update: apply annotations so far to the book
        const progress = Math.round(
          ((Object.keys(annotations).length) / allSentences.length) * 100
        );

        await updateQueue((prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.chapterId === chapter.id
              ? { ...ch, annotations: { ...annotations }, annotationProgress: progress }
              : ch
          ),
        }));

        // Throttle book re-renders: only apply every 2nd batch (or on last batch)
        if (batchCount % 2 === 0 || i + ANNOTATION_BATCH_SIZE >= unannotated.length) {
          applyAnnotationsToBook(book, chapter.id, annotations, onBookUpdate);
        }
      }

      return annotations;
    },
    [updateQueue, onBookUpdate]
  );

  // ── Priority scheduling ──

  const getNextChapter = useCallback(
    (queue: EnrichmentQueueState, book: Book): ChapterEnrichment | null => {
      const pending = queue.chapters.filter((ch) => ch.status === "pending" || ch.status === "error");
      if (pending.length === 0) return null;

      const readingId = readingChapterRef.current;
      const chapterIds = book.chapters.map((c) => c.id);

      // Priority: reading chapter > adjacent > sequential
      const getPriority = (chId: string): number => {
        if (chId === readingId) return 100;
        if (readingId) {
          const readIdx = chapterIds.indexOf(readingId);
          const chIdx = chapterIds.indexOf(chId);
          if (Math.abs(readIdx - chIdx) === 1) return 50;
        }
        return chapterIds.indexOf(chId); // lower index = higher priority for ties
      };

      pending.sort((a, b) => getPriority(b.chapterId) - getPriority(a.chapterId));
      return pending[0];
    },
    []
  );

  // ── Main processing loop ──

  const processQueue = useCallback(
    async (book: Book, queue: EnrichmentQueueState) => {
      while (!abortRef.current) {
        // Re-read latest state
        let currentQueue: EnrichmentQueueState | null = null;
        setQueueState((prev) => { currentQueue = prev; return prev; });
        if (!currentQueue) break;

        const next = getNextChapter(currentQueue!, book);
        if (!next) break;

        // Yield between chapters
        await yieldToMain();

        const chapter = book.chapters.find((c) => c.id === next.chapterId);
        if (!chapter) {
          // Mark as error and continue
          await updateQueue((prev) => ({
            ...prev,
            chapters: prev.chapters.map((ch) =>
              ch.chapterId === next.chapterId ? { ...ch, status: "error", error: "Chapter not found" } : ch
            ),
          }));
          continue;
        }

        // Mark as processing
        await updateQueue((prev) => ({
          ...prev,
          currentChapterId: chapter.id,
          chapters: prev.chapters.map((ch) =>
            ch.chapterId === chapter.id ? { ...ch, status: "processing" } : ch
          ),
        }));

        try {
          const finalAnnotations = await annotateChapter(book, chapter, next.annotations);

          if (!abortRef.current) {
            await updateQueue((prev) => ({
              ...prev,
              chapters: prev.chapters.map((ch) =>
                ch.chapterId === chapter.id
                  ? { ...ch, status: "completed", annotationProgress: 100, annotations: finalAnnotations }
                  : ch
              ),
            }));
          }
        } catch (err) {
          console.error("[EnrichmentQueue] Chapter failed:", chapter.id, err);
          await updateQueue((prev) => ({
            ...prev,
            chapters: prev.chapters.map((ch) =>
              ch.chapterId === chapter.id
                ? { ...ch, status: "error", error: err instanceof Error ? err.message : "Failed" }
                : ch
            ),
          }));
        }
      }
    },
    [getNextChapter, annotateChapter, updateQueue]
  );

  // ── Start enrichment ──

  const startEnrichment = useCallback(
    async (book: Book) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;
      bookRef.current = book;
      setError(null);

      const unsub = onLLMStateChange((s) => {
        setLlmStatus(s.status);
        setLlmProgress(s.progress);
      });

      try {
        // Check for existing queue state (resumability)
        let queue = await loadQueueState(book.id);

        if (!queue || queue.status === "completed") {
          queue = createInitialQueueState(
            book.id,
            book.chapters.map((c) => c.id)
          );
        }

        setQueueState(queue);
        setPhase("init-llm");

        // Init LLM
        const ok = await initLLM();
        if (!ok) throw new Error("Failed to initialize AI engine");
        if (abortRef.current) return;

        // Phase 1: Global analysis (if not already done)
        if (queue.globalCharacters.length === 0 && queue.globalThemes.length === 0) {
          setPhase("global-analysis");
          const { characters, themes } = await runGlobalAnalysis(book);
          if (abortRef.current) return;

          // Apply immediately
          onBookUpdate({ characters, themes });

          queue = {
            ...queue,
            status: "running",
            globalCharacters: characters,
            globalThemes: themes,
          };
          setQueueState(queue);
          await saveQueueState(queue);
        } else {
          // Restore previously found global data
          onBookUpdate({
            characters: queue.globalCharacters,
            themes: queue.globalThemes,
          });
          queue = { ...queue, status: "running" };
          setQueueState(queue);
        }

        if (abortRef.current) return;

        // Phase 2: Progressive chapter processing
        setPhase("chapter-processing");
        await processQueue(book, queue);

        if (!abortRef.current) {
          setPhase("completed");
          await updateQueue((prev) => (prev ? { ...prev, status: "completed", currentChapterId: null } : prev!));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Enrichment failed";
        console.error("[EnrichmentQueue]", err);
        setError(msg);
        setPhase("error");
      } finally {
        runningRef.current = false;
        unsub();
      }
    },
    [runGlobalAnalysis, processQueue, updateQueue, onBookUpdate]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    runningRef.current = false;
    setPhase("idle");
    // Persist paused state
    setQueueState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        status: "paused" as const,
        chapters: prev.chapters.map((ch) =>
          ch.status === "processing" ? { ...ch, status: "pending" as const } : ch
        ),
      };
      saveQueueState(next).catch(() => {});
      return next;
    });
  }, []);

  return {
    phase,
    queueState,
    llmStatus,
    llmProgress,
    error,
    startEnrichment,
    setReadingChapter,
    cancel,
  };
}

// ── Apply annotations to book data ──

function applyAnnotationsToBook(
  book: Book,
  chapterId: string,
  annotations: Record<string, string>,
  onUpdate: (patch: Partial<Book>) => void
) {
  const updatedChapters = book.chapters.map((ch) => {
    if (ch.id !== chapterId) return ch;
    return {
      ...ch,
      scenes: ch.scenes.map((scene) => ({
        ...scene,
        sentences: scene.sentences.map((sent) => {
          const ann = annotations[sent.id];
          if (ann && !sent.annotation) {
            return { ...sent, annotation: ann };
          }
          return sent;
        }),
      })),
    };
  });
  onUpdate({ chapters: updatedChapters });
}
