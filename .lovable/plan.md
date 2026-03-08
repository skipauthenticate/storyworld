

# Storyworld Production Readiness Audit

## Overview

After reviewing every file in the project, here is a comprehensive evaluation from UI/UX through infrastructure, with a concrete fix plan.

---

## A. Critical Blockers

### 1. `App.css` overrides break full-screen layout
`src/App.css` sets `#root { max-width: 1280px; margin: 0 auto; padding: 2rem; text-align: center; }` — this is Vite's default boilerplate and constrains the entire app to a centered 1280px box with padding. The app is designed as a full-bleed, edge-to-edge layout. This file must be emptied or deleted.

### 2. No error boundary
A single unhandled error (WASM crash, network failure) crashes the entire app with a white screen. Production apps need a top-level `ErrorBoundary` component with a styled recovery UI.

### 3. No loading state for initial app render
The app mounts and immediately shows the layout, but there's no suspense/loading boundary. If the TTS `initTTS()` or SDK imports are slow, there's no feedback.

### 4. CORS proxy edge function timeout for LLM model
The 350MB LLM model download through the edge function will almost certainly exceed the default execution time limit. The proxy streams data but doesn't control the upstream timeout. Need to either: (a) use HuggingFace URLs directly (they actually support CORS on `.gguf` files from `cdn-lfs.huggingface.co`), or (b) bypass the proxy for cached models.

---

## B. UI/UX Issues

### 5. No responsive/mobile layout
The three-panel layout (240px sidebar + reading + 340px intelligence) requires ~900px minimum. On tablet/mobile the UI overflows. Need:
- Collapsible sidebar as a drawer on `<1024px`
- Intelligence panel as a sheet/drawer on mobile
- Touch-friendly tap targets (many buttons are 10px text)

### 6. No light mode
The app is hardcoded to a dark palette only. No `prefers-color-scheme` handling or toggle. For a reading app, light mode is essential.

### 7. Empty books show as dead-end clicks
"1984" and "To Kill a Mockingbird" are disabled stubs with no content. Users clicking them see nothing happen. The "Coming Soon" badge is tiny (8px). Need clearer disabled states or remove them.

### 8. No onboarding or first-use guidance
No tooltip, tour, or hints about the three reading modes, keyboard shortcuts, or AI chat features. New users won't discover Space-to-play or the Intelligence panel.

### 9. Volume control is decorative
The `Volume2` icon in `NarrationControls` has no click handler. It's a static icon.

### 10. No reading progress persistence
`Book.progress` is hardcoded to 0 and never updated. When users close the app, they lose their place.

---

## C. Functional Gaps

### 11. No `@runanywhere/web` in dependencies
Both `tts-engine.ts` and `llm-engine.ts` import from `@runanywhere/web` (for `RunAnywhere`, `SDKEnvironment`, `extractTarGz`), but this package is NOT listed in `package.json`. This will cause a build failure. Must add it as a dependency.

### 12. Dynamic import of `@runanywhere/web` may fail silently
The TTS and LLM engines use `await import('@runanywhere/web')` at runtime. If the package is missing or fails to load, the `catch` block silently falls back but provides no user-facing feedback.

### 13. Chat history lost on tab switch
When switching from "AI Chat" to another tab and back, `useLLMChat` state persists (it's in the parent), but if the component unmounts and remounts, the scroll position resets.

### 14. No SEO or social sharing metadata beyond basics
`index.html` has minimal `og:` tags. No structured data, no `robots.txt` content beyond the default, no sitemap.

### 15. No PWA / offline support
A reading app is a strong PWA candidate. No service worker, no manifest, no offline caching.

---

## D. Code Quality & Performance

### 16. `globalIndex` variable in render
`ReadingPanel` uses a mutable `let globalIndex = 0` during render — this works but is fragile. Should use `useMemo` to pre-compute sentence-to-index mapping.

### 17. No code splitting
All components load eagerly. The heavy WASM/AI modules should lazy-load, and routes should use `React.lazy`.

### 18. `motion.span` with `layout` on every sentence
Every sentence has Framer Motion's `layout` animation. With 20+ sentences, this triggers expensive layout recalculations on every state change. Should remove `layout` or limit it to active sentences only.

### 19. Missing `key` on AnimatePresence children
`IntelligencePanel`'s `AnimatePresence` conditionally renders tabs but the `key` is inside the `motion.div`, not on the direct child. This may cause exit animations to fail.

---

## E. Security & Infrastructure

### 20. CORS proxy has no rate limiting
The `cors-proxy` edge function is open to the internet (`verify_jwt = false`) with no rate limiting. Anyone can use it as a proxy to GitHub/HuggingFace.

### 21. No analytics or error tracking
No way to know if users encounter errors, which features are used, or where they drop off.

### 22. No favicon or app icon
The app uses the default `public/favicon.ico`. A custom icon matching the Storyworld brand is needed.

---

## Implementation Plan

| # | Task | Category | Effort |
|---|------|----------|--------|
| 1 | Delete/empty `App.css` (layout-breaking override) | Critical | Tiny |
| 2 | Add `@runanywhere/web` to `package.json` | Critical | Tiny |
| 3 | Add React ErrorBoundary with styled fallback UI | Critical | Small |
| 4 | Add responsive layout: sidebar drawer + intelligence sheet on mobile | UX | Large |
| 5 | Add light mode theme variables + toggle | UX | Medium |
| 6 | Remove `layout` prop from non-active `motion.span` sentences | Perf | Small |
| 7 | Pre-compute sentence index mapping with `useMemo` in `ReadingPanel` | Code | Small |
| 8 | Add localStorage-based reading position persistence | Functional | Medium |
| 9 | Add keyboard shortcut hints overlay / onboarding tooltip | UX | Medium |
| 10 | Remove or wire Volume control | UX | Tiny |
| 11 | Bypass CORS proxy for IndexedDB-cached LLM model; test direct HF CDN | Infra | Medium |
| 12 | Add rate limiting header check to CORS proxy | Security | Small |
| 13 | Add custom Storyworld favicon/icon | Polish | Small |
| 14 | Add PWA manifest + basic service worker for offline reading | Feature | Medium |
| 15 | Improve empty book states (remove stubs or add real content) | UX | Small |

### Recommended implementation order:
1. Items 1-2 first (critical build/layout fixes)
2. Items 3, 6-7 (stability and performance)
3. Items 4-5 (responsive + light mode — highest UX impact)
4. Items 8-15 (feature completeness and polish)

