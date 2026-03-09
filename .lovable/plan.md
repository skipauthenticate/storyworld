

# Add Paginated Reading Mode (alongside existing scroll)

## Approach

Add a **page-turn mode** as an alternative to the existing scroll view. A toggle in the top bar lets users switch. Preference persists in localStorage.

## New file: `src/hooks/usePagedReader.ts`

A hook that takes a container ref and manages CSS column-based pagination:
- Uses `column-width` equal to the container width + `column-fill: auto` + `overflow: hidden` to let the browser split content into pages
- Tracks `currentPage` / `totalPages` (derived from `scrollWidth / clientWidth`)
- Recalculates on resize, font size change, and chapter change via `ResizeObserver`
- Exposes `nextPage()`, `prevPage()`, `goToPageContainingElement(el)`
- **Swipe gestures**: pointer events with 50px threshold for mobile swipe left/right
- **Tap zones**: left 30% = prev, right 30% = next (center does nothing)
- Smooth `translateX` CSS transition between pages
- When `activeSentenceIndex` changes during narration, auto-scrolls to the page containing the active sentence

## Edit: `src/components/storyworld/ReadingPanel.tsx`

- Add `readingMode` prop (`"scroll" | "page"`) and `onReadingModeChange` callback
- Add a toggle button in the top bar (scroll icon vs book/pages icon) between font controls and theme toggle
- When mode is `"page"`:
  - The content wrapper gets CSS columns styling and fixed height (flex-1)
  - Attach swipe/tap handlers from the hook
  - Show a page indicator at the bottom: "Page 3 of 12"
  - Hide the scroll-based "Continue to next chapter" button; instead auto-advance chapter when going past the last page
- When mode is `"scroll"`: existing behavior unchanged

## Edit: `src/pages/Index.tsx`

- Add `readingMode` state (persisted to localStorage like fontSize)
- Pass it to `ReadingPanel`
- Update keyboard handler: in page mode, Left/Right arrow = page turn; in scroll mode = sentence navigation (existing behavior)

## Files

| File | Action |
|------|--------|
| `src/hooks/usePagedReader.ts` | Create |
| `src/components/storyworld/ReadingPanel.tsx` | Edit |
| `src/pages/Index.tsx` | Edit |

