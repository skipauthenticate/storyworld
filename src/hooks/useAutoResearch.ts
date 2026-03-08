import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sampleBooks } from "@/data/sampleBooks";

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

export function useAutoResearch() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
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
  }, []);

  const runExperiment = useCallback(async (domain?: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);

    try {
      // Get current book data (Gatsby)
      const gatsby = sampleBooks.find((b) => b.id === "gatsby");
      if (!gatsby) throw new Error("No book data");

      const bookData = {
        title: gatsby.title,
        author: gatsby.author,
        themes: gatsby.themes,
        characters: gatsby.characters.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
        })),
        sentences: gatsby.chapters.flatMap((ch) =>
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

      // Get recent experiment history for context
      const recentExperiments = experiments.slice(0, 10).map((e) => ({
        domain: e.domain,
        description: e.description,
        composite_score: e.composite_score,
        status: e.status,
      }));

      const { data, error: fnErr } = await supabase.functions.invoke("autoresearch", {
        body: {
          domain,
          bookData,
          experimentHistory: recentExperiments,
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Edge function error");
      if (data?.error) throw new Error(data.error);

      // Prepend new experiment
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

  const runLoop = useCallback(async (count: number = 3, domain?: string) => {
    for (let i = 0; i < count; i++) {
      await runExperiment(domain);
      // Small delay between runs
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
  };
}
