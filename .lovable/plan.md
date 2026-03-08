## Production Readiness Evaluation

### Issues Found

**1. Stale Keyboard Hints (Bug)**
`KeyboardHints.tsx` still references `⌘+1/2/3` for "Classic / Narrated / Immersive mode" — those modes no longer exist. This is actively misleading.

**2. ThemeToggle and KeyboardHints Overlap**
Both are `fixed` positioned in the bottom-right / top-right corners. ThemeToggle is `fixed top-3 right-3`, KeyboardHints button is `fixed bottom-4 right-4`. On mobile, the ThemeToggle overlaps the mobile sidebar hamburger button (both `fixed top-3 left-3` / `top-3 right-3`). No z-index coordination strategy.

**3. No Authentication**
Reading progress is localStorage-only. The `experiments` table has no RLS policies visible, meaning it's either wide open or completely blocked. No user accounts, no cross-device sync.

**4. Single-Book Content**
Only The Great Gatsby has chapter content. Other books show "Coming Soon" but there's no import mechanism. The "EPUB & PDF import — coming soon" text is a dead promise.

**5. Intelligence Panel: 5 Tabs Is Heavy**  
Annotation, Characters, Themes, AI Chat, Research — five tabs crammed into a 340px sidebar. On mobile this is inside a Sheet. The tabs are tiny (10px mono text) and hard to hit on touch. Characters and Themes are also accessible from the sidebar bottom, creating duplicate navigation paths,

**6. AI Chat Requires 350MB Download**
The on-device LLM (Qwen2.5-0.5B) requires a 350MB download before first use. No fallback to a server-side model. Users hitting this for the first time will likely abandon. The 0.5B model quality is also quite limited for literary analysis.

**7. No Loading/Error States for Edge Cases**

- No skeleton/loading state when switching chapters
- No empty state if `sampleBooks` were empty (crashes)
- No offline handling
- `useAutoResearch` silently fails with console errors only

**8. Reading Progress is Fragile**

- Only saves one book's progress at a time (single localStorage key)
- No per-book progress tracking
- `loadProgress` runs once on mount with `[]` deps but `books` might not be stable

**9. No Responsive Polish**

- Intelligence panel on mobile opens as a Sheet but the 5-tab bar is cramped at 320px
- NarrationControls bottom bar has no safe-area-inset padding for iOS notch devices
- No landscape mobile consideration

**10. Accessibility Gaps**

- No ARIA labels on sentence spans (clickable but no `role="button"`)
- No skip-to-content link
- Keyboard hints popup has no focus trap
- Color-only indicators (character dots, highlight types) with no text alternatives
- No `aria-current` on active sentence during narration

**11. No User Onboarding**
First-time users see the welcome screen but get no guidance on what Voice/Intel toggles do, how sentence clicking works, or what the Research tab means.

**12. Redundancies**

- Characters/Themes accessible from both LibrarySidebar bottom buttons AND IntelligencePanel tabs — duplicate paths to same content
- `showCharacters`/`showThemes` state in Index.tsx forces the intelligence panel open AND switches tabs — overcomplicated when the tabs already exist
- Two toast providers mounted (`Toaster` + `Sonner`) but neither appears used

---

### Recommended Plan

**Phase 1 — Bug Fixes (immediate)**

- Update `KeyboardHints` to remove stale mode shortcuts, add only valid ones (Space, arrows)
- Fix z-index layering for fixed-position buttons (ThemeToggle, KeyboardHints, mobile hamburger, mobile Brain FAB)
- Add `safe-area-inset-bottom` padding to NarrationControls

**Phase 2 — UX Simplification**

- Remove Characters/Themes from LibrarySidebar bottom section; they live in the Intelligence Panel tabs. Remove `showCharacters`/`showThemes` state from Index.tsx
- Collapse Intelligence Panel tabs from 5 to 3: **Context** (merges Annotation + Characters + Themes into a single scrollable view), **Chat**, **Research**
- Add a brief tooltip or first-use overlay explaining the Voice and Intel toggles

**Phase 3 — AI Chat Improvement**

- Never add any fallback. Always want local llm. Evaluate better models too. Models should appear based on available hardware and surfaced to the user

**Phase 4 — Robustness**

- Add basic RLS policies to `experiments` table
- Upgrade reading progress to per-book localStorage or database-backed
- Add ARIA attributes to interactive sentence spans
- Add loading skeletons for chapter transitions
- Remove unused toast provider