

## Performance Audit: Book Analysis Flow

### Root Causes of Unresponsiveness

1. **TTS archive: `response.arrayBuffer()` blocks main thread** — `tts-engine.ts:99` loads the entire ~75MB TTS archive in one shot via `await response.arrayBuffer()`, freezing the UI for seconds. The LLM engine already uses streaming download, but TTS does not.

2. **No yielding between enrichment LLM calls** — `useEnrichmentQueue.ts` runs global analysis (2 LLM calls) then immediately loops through chapter annotations without ever yielding to the browser's paint cycle. Each `chatGenerate` call runs WASM inference on the main thread, and chaining them back-to-back compounds the freeze.

3. **Model data assembly blocks** — `llm-engine.ts:197-202` concatenates all downloaded chunks into a single ~350MB `Uint8Array` synchronously — a tight loop over hundreds of chunks with no yield.

4. **Annotation loop has no breathing room** — `annotateChapter` in `useEnrichmentQueue.ts` processes batches in a tight `for` loop, calling `chatGenerate` repeatedly. Even though each call is async, the WASM work between them allows no paint frames.

5. **`applyAnnotationsToBook` deep-clones entire book** — After every batch of 6 annotations, it maps over ALL chapters/scenes/sentences to produce a new book object, triggering a large React re-render tree.

### Plan

#### File: `src/lib/tts-engine.ts`
- Replace `response.arrayBuffer()` (line 99) with a **streaming download** matching the pattern already used in `llm-engine.ts` — read chunks via `response.body.getReader()`, concatenate at the end. This prevents the browser from buffering the entire 75MB response before returning.

#### File: `src/lib/llm-engine.ts`
- Add a **yield helper** (`const yieldToMain = () => new Promise(r => setTimeout(r, 0))`)
- Insert `await yieldToMain()` after assembling the model data (after the chunk concatenation loop, line ~202) and before writing to WASM filesystem, giving the browser a paint frame during the heaviest memory operations.

#### File: `src/hooks/useEnrichmentQueue.ts`
- Add `await yieldToMain()` between the two global analysis LLM calls (characters → themes)
- Add `await yieldToMain()` between each batch iteration in `annotateChapter`
- Add `await yieldToMain()` between each chapter in `processQueue`
- **Throttle `applyAnnotationsToBook`**: only call it every 2nd batch (or use a simple debounce) to halve the React re-render frequency during annotation

#### File: `src/hooks/useEnrichment.ts` (legacy hook, still imported)
- Add the same `yieldToMain()` calls between its sequential LLM calls for consistency

### What This Achieves
- The browser gets regular paint frames during all heavy operations (download, model load, inference)
- TTS download no longer freezes the tab for several seconds
- The annotation loop no longer starves the event loop
- Total enrichment time stays roughly the same (yields are <1ms each), but perceived responsiveness improves dramatically

