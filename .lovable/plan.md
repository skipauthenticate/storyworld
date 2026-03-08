## Production Readiness Audit — STORYWORLD

### Summary

The app has a solid foundation: good component decomposition, dark/light themes, TTS with fallback, EPUB import, on-device AI chat, keyboard shortcuts, mobile responsiveness, and reading progress persistence. However, several gaps exist across UX, data persistence, accessibility, and feature completeness.

---

### Critical Gaps

**1. Imported books don't persist across page refresh**
Books imported via EPUB are stored only in React state. Refresh = gone. This is the single biggest UX problem. Fix: persist the parsed `Book[]` to localStorage (or database for cross-device sync).

**2. "Coming Soon" placeholder books clutter the library**
1984 and To Kill a Mockingbird have zero chapters and show as disabled with a "Soon" badge. For a production app, either populate them or remove them. They set false expectations.

**3. No loading/error states for the reading panel**
If EPUB parsing is slow or the chapter content is large, there's no skeleton or spinner in the reading area. The import button shows "Parsing EPUB..." only in the welcome drop zone, not in the sidebar import path.

**4. Intelligence panel is empty for imported EPUBs**
Imported books have no `characters`, `themes`, or sentence `annotations`. The Intelligence panel shows "Tap any sentence to see its annotation" but tapping yields nothing useful — just the raw text and type classification. This is misleading.

**5. Auto-research is hardcoded to Gatsby**
`useAutoResearch` always sends Gatsby data to the edge function regardless of which book is active. It should use the active book's data, or be disabled for books without enrichment.

---

### UX Issues

**6. Confirm dialog for delete uses `window.confirm()**`
Native browser confirm dialogs break the app's visual identity. Should use a styled AlertDialog component (already installed via Radix).

**7. ThemeToggle and KeyboardHints overlap on mobile**
ThemeToggle is fixed `top-3 right-3`, KeyboardHints is `bottom-4 left-4`, and the mobile library hamburger is `top-3 left-3`. On mobile with the intelligence FAB at `bottom-20 right-3`, the corners get crowded. These should be consolidated into a single settings/toolbar area.

**8. No font size or reading preference controls**
Production readers expect adjustable font size, line height, and possibly font family. Currently hardcoded at 16-17.5px.

**9. No search within a book**
No way to find text across chapters.

**10. No bookmarks or highlights**
Users can click sentences but can't save highlights or bookmark positions for later.

**11. Play button is disabled until voice is enabled**
The play button requires `voiceEnabled && !ttsLoading && ttsEngine !== 'none'`. But enabling voice auto-downloads a 75MB TTS model. Users who just want sentence-by-sentence stepping (without audio) can't use the transport controls. The forward/back buttons work independently, but the play button's disabled state is confusing.

**12. Progress bar is per-sentence, not per-book**
The progress indicator shows sentence position within the current chapter. There's no overall book progress indicator (e.g., "32% through the book").

**13. No chapter completion / auto-advance**
When narration reaches the end of a chapter, playback stops. It doesn't auto-advance to the next chapter or prompt the user.

---

### Redundancy

**14. Duplicate EPUB import UI**
Both the sidebar (Plus button) and the welcome screen have independent file inputs for EPUB import. The logic is slightly different (sidebar doesn't show drag-and-drop). Not a bug, but the sidebar import gives no feedback during parsing.

**15. ResearchPanel component is unused**
`ResearchPanel.tsx` is fully implemented but never rendered anywhere in the app. It's dead code.

**16. `useReadingProgress` loads most-recent-book on mount but doesn't restore sentence position**
The hook returns `sentenceIndex` in the progress object, but `Index.tsx` only restores `book` and `chapter`, never calls `goToSentence(progress.sentenceIndex)`.

---

### Accessibility

**17. Every sentence is `role="button" tabIndex={0}**`
With hundreds of sentences per chapter, this creates an enormous tab order. Screen reader users would need to tab through every sentence. Consider making sentences non-focusable by default and using a different interaction model.

**18. No skip-to-content works on mobile**
The skip link exists but the mobile layout with a sheet-based sidebar means focus management is inconsistent.

---

### Recommended Priority Plan


| Priority | Item                                                                               | Effort |
| -------- | ---------------------------------------------------------------------------------- | ------ |
| P0       | Persist imported books to database, not localstorage                               | Small  |
| P0       | Restore sentence position from saved progress                                      | Tiny   |
| P1       | Remove or populate "Coming Soon" books                                             | Tiny   |
| P1       | Replace `window.confirm` with AlertDialog                                          | Small  |
| P1       | Show empty state / generate metadata hint for imported EPUBs in Intelligence panel | Small  |
| P1       | Fix auto-research to use active book or disable gracefully                         | Small  |
| P1       | Delete unused ResearchPanel.tsx                                                    | Tiny   |
| P2       | Add font size controls                                                             | Medium |
| P2       | Add book-level progress percentage                                                 | Small  |
| P2       | Auto-advance to next chapter on narration end                                      | Small  |
| P2       | Consolidate floating buttons into a toolbar                                        | Medium |
| P3       | Book search, bookmarks, highlights                                                 | Large  |
| P3       | Fix excessive tabIndex on sentences                                                | Small  |
