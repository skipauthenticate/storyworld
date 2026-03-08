import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/data/sampleBooks";

export interface Experiment {
  id: string;
  domain: string;
  target_id: string | null;
  description: string;
  before_value: string | null;
  after_value: string | null;
  score_insight: number | null;
  score_merit: number | null;
  score_coherence: number | null;
  score_originality: number | null;
  composite_score: number | null;
  status: string;
  applied: boolean;
  created_at: string;
}

const DEBOUNCE_MS = 60_000;

export function useAutoResearch() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTriggerRef = useRef<number>(0);

  const fetchExperiments = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("experiments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (err) {
        console.error("Failed to fetch experiments:", err);
        return;
      }
      setExperiments((data as unknown as Experiment[]) || []);
    } catch (networkErr) {
      console.error("[AutoResearch] Network error:", networkErr);
    }
  }, []);

  const runExperiment = useCallback(async (domain?: string, book?: Book) => {
    if (isRunning) return;
    if (!book || book.characters.length === 0) {
      console.warn("[AutoResearch] Book has no enrichment data, skipping");
      return;
    }
    setIsRunning(true);
    setError(null);

    try {
      const bookData = {
        title: book.title,
        author: book.author,
        themes: book.themes,
        characters: book.characters.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
        })),
        sentences: book.chapters.flatMap((ch) =>
          ch.scenes.flatMap((sc) =>
            sc.sentences.map((s) => ({
              id: s.id,
              text: s.text.substring(0, 120),
              type: s.type,
              emotion: s.emotion,
              annotation: s.annotation?.substring(0, 150),
            }))
          )
        ),
      };

      const recentExperiments = experiments.slice(0, 10).map((e) => ({
        domain: e.domain,
        description: e.description,
        composite_score: e.composite_score,
        status: e.status,
      }));

      const { data, error: fnErr } = await supabase.functions.invoke("autoresearch", {
        body: { domain, bookData, experimentHistory: recentExperiments },
      });

      if (fnErr) throw new Error(fnErr.message || "Edge function error");
      if (data?.error) throw new Error(data.error);

      if (data?.id) {
        setExperiments((prev) => [data as unknown as Experiment, ...prev]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      console.error("[AutoResearch]", msg);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, experiments]);

  const triggerImprovement = useCallback((domain?: string, book?: Book) => {
    try {
      const now = Date.now();
      if (now - lastTriggerRef.current < DEBOUNCE_MS) return;
      if (isRunning) return;
      if (!book || book.characters.length === 0) return;
      lastTriggerRef.current = now;
      runExperiment(domain, book).catch((err) => {
        console.warn("[AutoResearch] Background trigger failed:", err);
      });
    } catch (err) {
      console.warn("[AutoResearch] triggerImprovement error:", err);
    }
  }, [isRunning, runExperiment]);

  const runLoop = useCallback(async (count: number = 3, domain?: string, book?: Book) => {
    for (let i = 0; i < count; i++) {
      try {
        await runExperiment(domain, book);
      } catch (err) {
        console.warn(`[AutoResearch] Loop iteration ${i} failed:`, err);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, [runExperiment]);

  return {
    experiments,
    isRunning,
    error,
    fetchExperiments,
    runExperiment,
    runLoop,
    triggerImprovement,
  };
}
