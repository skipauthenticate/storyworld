import { useState, useCallback, useRef } from "react";
import {
  initLLM,
  chatGenerate,
  onLLMStateChange,
  getLLMState,
  type LLMEngineStatus,
} from "@/lib/llm-engine";
import type { Book, Character } from "@/data/sampleBooks";

export type EnrichmentPhase =
  | "idle"
  | "init-llm"
  | "extracting-characters"
  | "extracting-themes"
  | "annotating"
  | "done"
  | "error";

interface EnrichmentState {
  phase: EnrichmentPhase;
  progress: number; // 0-100
  error: string | null;
  llmStatus: LLMEngineStatus;
  llmProgress: number;
}

const CHARACTER_COLORS = [
  "hsl(210, 50%, 55%)",
  "hsl(40, 60%, 50%)",
  "hsl(120, 30%, 55%)",
  "hsl(0, 40%, 50%)",
  "hsl(270, 40%, 55%)",
  "hsl(180, 40%, 50%)",
  "hsl(330, 45%, 55%)",
  "hsl(60, 45%, 45%)",
];

function extractTextSample(book: Book, maxChars = 3000): string {
  const lines: string[] = [];
  let chars = 0;
  for (const ch of book.chapters) {
    for (const sc of ch.scenes) {
      for (const s of sc.sentences) {
        if (chars + s.text.length > maxChars) return lines.join("\n");
        lines.push(s.text);
        chars += s.text.length;
      }
    }
  }
  return lines.join("\n");
}

function tryParseJSON(text: string): any | null {
  // Try to extract JSON from LLM output (may be wrapped in markdown code blocks)
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Try the whole thing first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Try extracting first JSON array or object
  const match = cleaned.match(/[\[{][\s\S]*?[\]}]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

export function useEnrichment() {
  const [state, setState] = useState<EnrichmentState>({
    phase: "idle",
    progress: 0,
    error: null,
    llmStatus: getLLMState().status,
    llmProgress: getLLMState().progress,
  });
  const abortRef = useRef(false);

  const enrich = useCallback(
    async (
      book: Book,
      onUpdate: (patch: Partial<Book>) => void
    ): Promise<void> => {
      abortRef.current = false;
      setState({
        phase: "init-llm",
        progress: 0,
        error: null,
        llmStatus: getLLMState().status,
        llmProgress: getLLMState().progress,
      });

      // Subscribe to LLM download progress
      const unsub = onLLMStateChange((s) => {
        setState((prev) => ({
          ...prev,
          llmStatus: s.status,
          llmProgress: s.progress,
        }));
      });

      try {
        // 1. Init LLM
        const ok = await initLLM();
        if (!ok) throw new Error("Failed to initialize AI engine");
        if (abortRef.current) return;

        const sample = extractTextSample(book, 2500);
        const title = book.title;
        const author = book.author;

        // 2. Extract characters
        setState((prev) => ({ ...prev, phase: "extracting-characters", progress: 20 }));

        const charPrompt = `Analyze this excerpt from "${title}" by ${author}. Identify the main characters (up to 6). Return ONLY a JSON array of objects with "name" and "description" fields. Each description should be 1-2 sentences. Example: [{"name":"Jay Gatsby","description":"A mysterious millionaire driven by hope."}]

Text:
${sample}`;

        const charResponse = await chatGenerate(
          [{ role: "user", content: charPrompt }],
          { maxTokens: 400, temperature: 0.3 }
        );
        if (abortRef.current) return;

        let characters: Character[] = [];
        const charData = tryParseJSON(charResponse);
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

        // Apply characters immediately
        onUpdate({ characters });

        // 3. Extract themes
        setState((prev) => ({ ...prev, phase: "extracting-themes", progress: 50 }));
        if (abortRef.current) return;

        const themePrompt = `What are the major themes in "${title}" by ${author}? Return ONLY a JSON array of short theme strings (3-6 words each), up to 6 themes. Example: ["The American Dream","Class and social mobility"]

Text:
${sample.substring(0, 1500)}`;

        const themeResponse = await chatGenerate(
          [{ role: "user", content: themePrompt }],
          { maxTokens: 200, temperature: 0.3 }
        );
        if (abortRef.current) return;

        let themes: string[] = [];
        const themeData = tryParseJSON(themeResponse);
        if (Array.isArray(themeData)) {
          themes = themeData
            .filter((t: any) => typeof t === "string")
            .slice(0, 6)
            .map((t: string) => t.trim());
        }

        onUpdate({ themes });

        // 4. Annotate first chapter sentences (batch of first ~8 sentences)
        setState((prev) => ({ ...prev, phase: "annotating", progress: 70 }));
        if (abortRef.current) return;

        const firstChapter = book.chapters[0];
        if (firstChapter) {
          const sentences = firstChapter.scenes.flatMap((s) => s.sentences).slice(0, 8);
          const sentTexts = sentences.map((s, i) => `[${i}] ${s.text}`).join("\n");

          const annotatePrompt = `You are a literary analyst. For each numbered sentence below from "${title}", write a brief annotation (1-2 sentences) about its literary significance. Return ONLY a JSON array of strings, one annotation per sentence in order.

${sentTexts}`;

          const annotateResponse = await chatGenerate(
            [{ role: "user", content: annotatePrompt }],
            { maxTokens: 512, temperature: 0.4 }
          );
          if (abortRef.current) return;

          const annotations = tryParseJSON(annotateResponse);
          if (Array.isArray(annotations)) {
            // Apply annotations to the first chapter's sentences
            const updatedChapters = [...book.chapters];
            const ch = { ...updatedChapters[0] };
            ch.scenes = ch.scenes.map((scene) => ({
              ...scene,
              sentences: scene.sentences.map((sent) => {
                const flatIdx = firstChapter.scenes
                  .flatMap((s) => s.sentences)
                  .findIndex((s) => s.id === sent.id);
                if (flatIdx >= 0 && flatIdx < annotations.length && typeof annotations[flatIdx] === "string") {
                  return { ...sent, annotation: annotations[flatIdx] };
                }
                return sent;
              }),
            }));
            updatedChapters[0] = ch;
            onUpdate({ chapters: updatedChapters });
          }
        }

        setState((prev) => ({ ...prev, phase: "done", progress: 100 }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Enrichment failed";
        console.error("[Enrichment]", err);
        setState((prev) => ({ ...prev, phase: "error", progress: 0, error: msg }));
      } finally {
        unsub();
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({ ...prev, phase: "idle", progress: 0 }));
  }, []);

  return { ...state, enrich, cancel };
}
