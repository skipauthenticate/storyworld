

# Auto-Start Enrichment on EPUB Import

## Changes

### 1. `src/pages/Index.tsx` — Trigger enrichment after import
- Lift `useEnrichmentQueue` from `IntelligencePanel` up to `Index` so it persists regardless of panel visibility
- After `parseEpub` succeeds and the book is added, call `startEnrichment(book)` automatically
- Pass enrichment state down to `IntelligencePanel` as props instead of it owning the hook

### 2. `src/components/storyworld/IntelligencePanel.tsx` — Remove manual trigger
- Remove the "Enrich Book" button and the idle/no-enrichment state from `EnrichmentSection`
- `EnrichmentSection` becomes a passive status display: shows progress when running, "complete" when done, error/retry when failed
- Keep pause/resume and chapter progress as-is
- Accept enrichment state as props instead of calling `useEnrichmentQueue` internally

### 3. Progressive availability
- Characters and themes sections already render reactively from `book.characters` and `book.themes` — no changes needed, they appear as soon as global analysis completes
- Annotations already appear on sentences via `SentenceRenderer` dotted underline — no changes needed
- Chapter progress section already updates in real-time

## Flow After Changes

1. User imports EPUB → book loads → enrichment starts immediately in background
2. Intelligence panel shows progress passively (no user action required)
3. Characters appear ~30s in, themes shortly after, annotations stream per-chapter
4. User reads normally; enrichment continues silently

