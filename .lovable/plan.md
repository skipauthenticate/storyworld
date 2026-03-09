

## Audit Results: Voice/Narration System

### Bugs Found

**1. Speed changes have no effect during playback (PRIMARY BUG)**
In `useNarration.ts`, `speakCurrent` captures `speed` via its `useCallback([speed])` closure. During continuous playback, the recursive chain (`advance` → `setTimeout` → `speakCurrent(nextIdx)`) holds a reference to the **original** `speakCurrent` from when Play was pressed. When the user changes speed, a new `speakCurrent` is created but the running chain still uses the old closure with the old speed value. Both TTS and timer-based modes are affected.

**Fix**: Add a `speedRef` that always holds the latest speed. Read `speedRef.current` inside `speakCurrent` instead of the closed-over `speed` value. Remove `speed` from the `useCallback` dependency array to keep the function reference stable.

**2. Web Speech API `onend` never fires for long sentences (Chrome bug)**
Chrome's Web Speech API has a well-known bug where `onend` never fires for utterances longer than ~15 seconds, causing playback to permanently stall. No watchdog timer exists.

**Fix**: Add a watchdog timer in `speakWithWebSpeech` that estimates max duration based on text length and speed, then force-calls `onEnd` if `onend` hasn't fired.

**3. No cancellation guard during TTS synthesis**
When the user presses Pause or skips while `TTS.synthesize()` is in-flight (which can take hundreds of ms), the synthesis completes and attempts to play on a potentially disposed player, causing errors or ghost audio.

**Fix**: Add a cancellation token (incrementing counter) to `speakSentence`. Before playing synthesized audio, check if the token is still current. If not, discard the result silently.

**4. `togglePlay` recreates on every speed change**
Because `speakCurrent` is in `togglePlay`'s dependency array, and `speakCurrent` depends on `speed`, every speed change creates a new `togglePlay` reference. This is wasteful and can cause stale-closure issues with keyboard handlers.

**Fix**: With `speedRef`, `speakCurrent` no longer depends on `speed`, making both `speakCurrent` and `togglePlay` stable.

### Files to Change

**`src/hooks/useNarration.ts`**
- Add `speedRef` synced via `useEffect`
- In `speakCurrent`: read `speedRef.current` instead of `speed`; remove `speed` from deps
- Pass `speedRef.current` to both `speakSentence()` and `estimateReadingMs()`

**`src/lib/tts-engine.ts`**
- Add a `speakGeneration` counter; increment on every `speakSentence` call and on `stopSpeaking`
- Before `player.play()`, check generation is still current; if stale, dispose and return
- In `speakWithWebSpeech`: add a watchdog timer (`estimatedDuration + 3s`) that calls `onEnd` if `onend` hasn't fired; clear watchdog on normal end
- Cancel Web Speech `speechSynthesis.cancel()` is already handled by `stopSpeaking`, which is good

**`src/pages/Index.tsx`** — no changes needed (the `useEffect` syncing `speed` → `setNarrationSpeed` is fine and will continue to update the ref)

