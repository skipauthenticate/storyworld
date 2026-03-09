

## Auto-Start Enrichment and Resume on Return

### Problem
1. There's no "Enrich" toggle at upload time — enrichment always auto-starts regardless of user intent.
2. A "Start Enrichment" button appears in the Intelligence Panel when it shouldn't — enrichment should be fully automatic.
3. Resume on page reload only checks for missing characters/themes, not for paused/incomplete IndexedDB queue state.

### Changes

**`src/components/storyworld/LibrarySidebar.tsx`**
- Add an "Enrich" toggle (Switch) to the EPUB import flow. When user picks a file, show a small confirmation with the toggle before importing, or simpler: add a state `enrichOnImport` (default true) and pass it through the callback.
- Simplest approach: change `onImportEpub` signature to `(file: File, enrich: boolean) => void`. Add a checkbox/switch next to the import button labeled "Enrich on import" that defaults to on.

**`src/pages/Index.tsx`**
- Update `handleImportEpub` to accept `(file: File, enrich: boolean)`. Only call `enrichment.startEnrichment(book)` if `enrich` is true.
- On mount (restore progress effect), also check IndexedDB for paused/incomplete queue state using `loadQueueState(book.id)`. If found with status `"paused"` or `"running"` (interrupted), auto-resume enrichment.

**`src/components/storyworld/IntelligencePanel.tsx`**
- Remove the "Start Enrichment" button from the idle state. Replace with a passive "No enrichment" message (no button).
- Keep the "Resume Enrichment" button for paused state (as a fallback), but the primary mechanism is auto-resume on mount.
- Remove the "No enrichment yet" + button block (lines 230-241). Show only a subtle label like "Enrichment not enabled" instead.

### Data Flow
```text
Upload EPUB ──► parseEpub() ──► addBook()
                                    │
                        enrich=true? ──► startEnrichment(book)
                                    │
                        enrich=false ──► no enrichment
                                    
Page reload ──► loadProgress() ──► find book
                                    │
                        loadQueueState(bookId) from IndexedDB
                                    │
                        status=paused/running? ──► startEnrichment(book)
                        status=completed? ──► no-op
                        no state? ──► no-op
```

### Resume Logic Detail
- `useEnrichmentQueue.startEnrichment` already handles resume — it loads from IndexedDB and skips completed chapters. We just need to call it on mount when there's incomplete work.
- The `saveQueueState` calls throughout the queue already persist progress on every batch, so closing mid-enrichment preserves all completed work.

