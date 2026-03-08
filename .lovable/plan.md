

## Plan: Comprehensive Error Handling

### Problem
The app crashes or hangs silently in several places — most critically, the CORS proxy blocks HuggingFace redirects to `cas-bridge.xethub.hf.co`, breaking both LLM and TTS model downloads. Beyond that, many async operations lack try/catch, timeouts, or graceful degradation.

### Changes

**1. Fix CORS proxy redirect blocking (root cause of model download failures)**
`supabase/functions/cors-proxy/index.ts` — Add `cas-bridge.xethub.hf.co` and `*.hf.co` to allowed hosts so HuggingFace CDN redirects succeed.

**2. Harden LLM engine**
`src/lib/llm-engine.ts`:
- Guard `response.body` null check instead of `!` force-unwrap
- Add download timeout (5 min)
- Wrap all dynamic imports in try/catch with meaningful errors
- Allow retry after error (reset `initPromise` on failure already exists, but `cancelGeneration` needs safety)

**3. Harden TTS engine**
`src/lib/tts-engine.ts`:
- Add download timeout
- Wrap `extractTarGz` in try/catch
- Ensure fallback to webspeech always runs even on unexpected errors

**4. Harden useLLMChat hook**
`src/hooks/useLLMChat.ts`:
- Wrap `initEngine` in try/catch
- Ensure `isGenerating` is always reset on any error path
- Handle case where `chatGenerate` throws before any tokens arrive (avoid orphan user message)

**5. Harden useAutoResearch hook**
`src/hooks/useAutoResearch.ts`:
- Wrap `fetchExperiments` in full try/catch (currently only checks supabase error, not network failure)
- Add timeout to edge function call
- Ensure `triggerImprovement` never throws (fire-and-forget)

**6. Harden useNarration hook**
`src/hooks/useNarration.ts`:
- Wrap `speakCurrent` body in try/catch so a TTS failure doesn't halt narration chain
- Wrap `initTTS` call in try/catch

**7. Safe IntelligencePanel chat**
`src/components/storyworld/IntelligencePanel.tsx`:
- Wrap `handleSend`'s `initEngine` call in try/catch and show inline error
- Show a user-friendly message when engine status is `error` instead of just the download button

**8. Safe Index.tsx**
`src/pages/Index.tsx`:
- Wrap `loadProgress` usage in try/catch (already somewhat safe but could still throw on corrupt data)
- Ensure keyboard handler never throws

All changes follow the same principle: catch at the boundary, log, and continue with whatever is available. No crashes, no frozen UI.

