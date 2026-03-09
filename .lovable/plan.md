
## Show Enrichment Progress Subtly

### Problem
The current enrichment status is either hidden (nothing shown in ContextContent during processing) or a large card. The user wants a subtle, always-visible indicator.

### Approach
Two-pronged subtle display:

**1. Intelligence Panel header — thin progress bar + micro label**
Replace the big processing card in `EnrichmentSection` with a minimal indicator embedded in the panel header:
- A `1.5px` animated progress bar running across the full width at the bottom of the "Intelligence" header strip, filling `overallProgress%` in primary color with a smooth transition
- A tiny `Enriching · 67%` chip next to the "Intelligence" label — only visible when active, disappears when idle/completed

**2. Library sidebar book item — small animated dot**
Add a tiny status dot on the active book row in the sidebar:
- Pulsing primary dot while enriching
- Solid green checkmark-size dot when completed
- Nothing (invisible) when idle/no enrichment

### Specific File Changes

**`src/components/storyworld/IntelligencePanel.tsx`**
- Add `overallProgress` + `phase` computation in the main `IntelligencePanel` component (already has access via `enrichment` prop)
- In the header `<div>`, add:
  - A small `Enriching · {pct}%` span that fades in when `isProcessing`
  - A `1.5px` absolute-positioned bar at the bottom of the header that fills `overallProgress%`
- In `EnrichmentSection`, remove the `isProcessing` card entirely (the big spinner + progress bar block). Keep only: idle-no-enrichment, error, completed, and paused resume button states.

**`src/pages/Index.tsx`**
- Pass `enrichment` to `LibrarySidebar` (new prop) for both desktop and mobile

**`src/components/storyworld/LibrarySidebar.tsx`**
- Accept optional `enrichment?: { phase: QueuePhase, overallProgress: number }` prop
- In the book row, show a `w-1.5 h-1.5` dot to the left of the chevron:
  - `animate-pulse bg-primary` when enriching
  - `bg-primary/40` (static, small) when completed
  - hidden otherwise
- No need to pass down all chapters — just `phase` + `overallProgress` are enough to show the dot

### Visual Result
```text
┌─────────────────────────┐
│ INTELLIGENCE   Enriching 67% │ ← tiny chip, fades out when done
├─────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░│ ← 1.5px progress bar (primary color)
│                         │
│  ...content...          │

Library sidebar book row:
  📕 My Book           ●  >   ← pulsing dot while enriching
```
