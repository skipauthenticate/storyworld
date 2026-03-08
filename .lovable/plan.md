

# Storyworld End-to-End Audit: Gaps and Fix Plan

## Summary of Findings

After reviewing every component, hook, engine, and configuration file, here are the identified gaps organized by severity.

---

## Critical Gaps

### 1. TTS: RunAnywhere works but audio playback may silently fail
- `speakSentence` in `tts-engine.ts` uses `AudioPlayback` from `@runanywhere/web-onnx`, but there's no error handling around `player.play()` failing due to browser autoplay policies (user must interact first).
- **Fix:** Add a user-gesture guard; catch autoplay errors and prompt the user to click play again.

### 2. LLM: CORS proxy may timeout on 350MB download
- The edge function `cors-proxy` streams a 350MB model through a serverless function. Edge functions have execution time limits (~60s default). The download will almost certainly timeout for the LLM model.
- **Fix:** Increase edge function timeout or, better, host the model on a storage bucket with proper CORS headers. Alternatively, chunk the download or use a CDN that already serves CORS headers.

### 3. LLM: `@runanywhere/web-llamacpp` import path may be wrong
- The code imports `@runanywhere/web-llamacpp` but the `TextGeneration.generateStream` and `TextGeneration.generate` APIs are unverified — if the SDK doesn't expose these exact methods, the chat will silently fail.
- **Fix:** Verify the actual SDK API surface. Add defensive checks and meaningful error messages.

### 4. LLM: Model not cached — 350MB re-download every session
- `initLLM` buffers the entire model in memory and writes to WASM FS. There's no persistence (IndexedDB/OPFS). Users re-download on every page load.
- **Fix:** Cache the model bytes in IndexedDB or OPFS after first download, check cache before fetching.

---

## Functional Gaps

### 5. Chapter change doesn't reset narration index
- When switching chapters via sidebar, `setSelectedSentence(null)` is called but `activeSentenceIndex` in `useNarration` is never reset to 0. The narration will try to speak from the old index.
- **Fix:** Add a `reset()` method to `useNarration` and call it in `handleSelectChapter`.

### 6. Keyboard shortcuts conflict with chat input
- The `keydown` handler in `Index.tsx` checks `HTMLInputElement` but the chat input in `IntelligencePanel` can still trigger Space (play/pause) when focus leaks. The `handleKeyDown` in `ChatTab` calls `e.stopPropagation()` only for Enter.
- **Fix:** Add `e.stopPropagation()` for all keys in the chat input, or refine the global handler to exclude the chat panel.

### 7. `showCharacters` state causes infinite re-render risk
- In `IntelligencePanel`, line 27-29 calls `setActiveTab("characters")` during render when `showCharacters && activeTab !== "characters"`. This is a setState-during-render anti-pattern.
- **Fix:** Use `useEffect` to sync the tab when `showCharacters` changes.

### 8. Themes button in sidebar does nothing
- `LibrarySidebar` line 162 has a Themes button with no `onClick` handler — it's a dead button.
- **Fix:** Wire it to open the Intelligence panel on the Themes tab.

### 9. "Drag an EPUB or PDF to import" is non-functional
- `WelcomeScreen` shows an upload hint but there's no drop handler or file import logic.
- **Fix:** Either implement a basic EPUB/text importer, or remove/restyle as "coming soon."

### 10. Reading mode switch to "classic" while playing doesn't stop speech immediately
- The `useEffect` in `useNarration` (line 120-126) catches this, but `stopSpeaking()` only cancels Web Speech API — for RunAnywhere, there's no abort mechanism during `AudioPlayback.play()`.
- **Fix:** Track the `AudioPlayback` instance and call `player.dispose()` on stop.

### 11. Speed changes don't take effect mid-sentence
- `speed` is passed to `speakSentence` at call time, so changing speed only applies to the next sentence. For Web Speech, `utterance.rate` is set once.
- **Fix:** Document this as expected behavior, or for Web Speech, modify the active utterance's rate.

---

## Minor / Polish Gaps

### 12. React ref warnings in console
- `AnimatePresence` in `LibrarySidebar` and `WelcomeScreen` receives refs it can't handle — the console shows "Function components cannot be given refs."
- **Fix:** Wrap `motion.div` children in `forwardRef` or restructure the AnimatePresence usage.

### 13. No auto-scroll to active sentence during narration
- `ReadingPanel` doesn't scroll the active sentence into view when narration advances.
- **Fix:** Add a ref + `scrollIntoView({ behavior: 'smooth', block: 'center' })` for the active sentence.

### 14. Progress tracking is static
- `Book.progress` and `Book.totalSentences` are hardcoded in `sampleBooks.ts` and never updated.
- **Fix:** Compute progress dynamically from `activeSentenceIndex / allSentences.length`.

### 15. No mobile/responsive layout
- The sidebar (240px) + reading panel + intelligence panel (340px) won't fit on screens < 1024px.
- **Fix:** Collapse sidebar and intelligence panel into drawers/sheets on mobile.

---

## Proposed Implementation Order

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Fix chapter-change narration reset (#5) | Small |
| 2 | Fix setState-during-render in IntelligencePanel (#7) | Small |
| 3 | Fix React ref warnings (#12) | Small |
| 4 | Add auto-scroll to active sentence (#13) | Small |
| 5 | Wire Themes sidebar button (#8) | Small |
| 6 | Fix keyboard shortcut conflicts with chat (#6) | Small |
| 7 | Add AudioPlayback cancel for RunAnywhere stop (#10) | Medium |
| 8 | Add autoplay policy handling for TTS (#1) | Medium |
| 9 | Cache LLM model in IndexedDB/OPFS (#4) | Medium |
| 10 | Fix CORS proxy timeout for large models (#2) | Medium |
| 11 | Remove or implement EPUB import hint (#9) | Small |
| 12 | Add responsive/mobile layout (#15) | Large |

