

## Plan: Auto-Improving Research Loop + Unified Reading View

### 1. Auto-Improving Without User Action

Instead of a manual "improve more" button, the research loop triggers silently on natural reading actions:

- **Sentence click**: After a user clicks a sentence (already wired via `onSelectSentence`), silently fire `runExperiment` in the background with a domain relevant to the sentence (e.g., `annotations` for the clicked sentence's context)
- **Chapter change**: When a user switches chapters, trigger an experiment
- **Debounce**: Throttle so experiments run at most once every 60 seconds to avoid spamming
- **Remove manual controls**: Strip the "improve more" link from `ResearchPanel`. The feed becomes purely observational — a live log of improvements happening in the background

**Files changed:**
- `src/hooks/useAutoResearch.ts` — add a `triggerImprovement(domain?, context?)` that debounces internally
- `src/pages/Index.tsx` — call `triggerImprovement` inside `handleSelectSentence` and `handleSelectChapter`
- `src/components/storyworld/ResearchPanel.tsx` — remove manual trigger button, keep the passive feed

### 2. Consolidate Three Reading Modes Into One View

Currently the three modes differ only in:
- **Classic**: no sentence highlighting, no narration bar, no intelligence panel
- **Narrated**: adds highlighting + narration bar
- **Immersive**: adds intelligence panel

**New design**: A single reading view with two independent toggles in the bottom narration bar area:

- **Voice toggle** (speaker icon): enables/disables TTS narration + sentence highlighting
- **Intelligence toggle** (brain icon): shows/hides the right-side intelligence panel

The mode selector in `LibrarySidebar` is removed entirely. The narration bar always shows at the bottom (with play controls greyed out when voice is off). This gives users granular control without the cognitive overhead of named modes.

**Files changed:**
- `src/pages/Index.tsx` — replace `readingMode` state with two booleans: `voiceEnabled` and `intelligenceEnabled`. Remove mode-switching logic. Always show narration bar. Pass flags down.
- `src/components/storyworld/LibrarySidebar.tsx` — remove the "Reading Mode" section and all `modeConfig`/`onSetMode` props
- `src/components/storyworld/NarrationControls.tsx` — add voice and intelligence toggle buttons; always render
- `src/components/storyworld/SentenceRenderer.tsx` — use `voiceEnabled` boolean instead of mode string for highlighting logic
- `src/components/storyworld/ReadingPanel.tsx` — pass `voiceEnabled` instead of `readingMode`
- `src/hooks/useNarration.ts` — use `voiceEnabled` boolean instead of mode string
- Keyboard shortcuts: `Space` toggles play (when voice enabled), remove `Cmd+1/2/3`

### Integration Point

Both features connect: when the user toggles on the intelligence panel, the research feed is visible and auto-populating from their reading actions. The experience is: read naturally, and the system quietly improves itself in the background.

