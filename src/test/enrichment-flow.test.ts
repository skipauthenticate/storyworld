import { describe, it, expect, vi } from "vitest";
import {
  createInitialQueueState,
  type EnrichmentQueueState,
} from "@/lib/enrichment-storage";

describe("enrichment flow", () => {
  it("should create initial queue state with all chapters pending", () => {
    const chapterIds = ["ch-1", "ch-2", "ch-3"];
    const state = createInitialQueueState("book-123", chapterIds);

    expect(state.bookId).toBe("book-123");
    expect(state.status).toBe("idle");
    expect(state.globalCharacters).toEqual([]);
    expect(state.globalThemes).toEqual([]);
    expect(state.chapters).toHaveLength(3);
    expect(state.chapters.every((ch) => ch.status === "pending")).toBe(true);
    expect(state.chapters.every((ch) => ch.annotationProgress === 0)).toBe(true);
    expect(state.chapters.map((ch) => ch.chapterId)).toEqual(chapterIds);
  });

  it("should allow enrichment to start on a book without prior enrichment", () => {
    // Simulates the scenario where a book was imported without enrichment
    // and the user clicks "Start Enrichment" later
    const state = createInitialQueueState("book-no-enrich", ["ch-a", "ch-b"]);

    // Queue should be ready to process
    expect(state.status).toBe("idle");
    expect(state.chapters.filter((ch) => ch.status === "pending")).toHaveLength(2);
  });

  it("should handle empty chapter list gracefully", () => {
    const state = createInitialQueueState("empty-book", []);

    expect(state.chapters).toHaveLength(0);
    expect(state.status).toBe("idle");
  });
});
