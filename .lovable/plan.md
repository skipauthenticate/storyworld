
## Add Multiple TTS Voices with a Switcher

### What's Available
- **Voice 1**: `en_US-lessac` — US English, already implemented (~64 MB, cached after first load)
- **Voice 2**: `en_GB-alba` — British English, same size, same Piper/sherpa-onnx pipeline
- **Voice 3**: System (Web Speech API) — zero download, uses OS voice

### Plan

#### `src/lib/tts-engine.ts`
- Add a `VoiceId` type: `'piper-en-lessac' | 'piper-en-alba' | 'webspeech'`
- Add second voice config constant: archive URL for `vits-piper-en_GB-alba-medium.tar.gz`, model dir `/models/piper-en-alba`
- Change `initTTS` to `initTTS(voiceId?: VoiceId)` — loads the specified Piper voice (or lessac by default). Each voice has its own `initPromise` so switching re-initializes if needed.
- Add `setActiveVoice(voiceId: VoiceId): Promise<TTSEngine>` — loads voice if not already cached, updates `ttsState`
- `speakSentence` already uses whatever `ttsState.engine` is — but needs to pass the active `voiceId` to `TTS.synthesize`. Add an `activeVoiceId` module-level var used in `speakSentence`.

#### `src/hooks/useNarration.ts`
- Add `voiceId: VoiceId` to `UseNarrationOptions` and `setVoice(id: VoiceId): void` to the return type
- On voice change: stop speaking, call `setActiveVoice(id)` which returns the new engine, update `ttsEngine` state

#### `src/components/storyworld/NarrationControls.tsx`
- Add `voiceId`, `availableVoices`, `onVoiceChange` props
- Replace the plain `Volume2`/`VolumeX` toggle button with a **Popover trigger** (keep same icon + label). Inside the popover, show 3 compact rows — one per voice — with a dot indicator for the active one and a small download indicator (spinner) when loading. No ugly dropdowns: just a clean popover matching the existing keyboard shortcuts popover style.

```text
┌─────────────────────────┐
│ VOICE                   │
├─────────────────────────┤
│ ● AI Voice · US         │  ← active, primary dot
│   AI Voice · British    │  ← click to switch (shows spinner while loading)
│   System Voice          │  ← instant, no download
└─────────────────────────┘
```

#### `src/pages/Index.tsx`
- Add `voiceId` state (default `'piper-en-lessac'`)
- Pass `voiceId` and `onVoiceChange` through to `NarrationControls`
- Pass `voiceId` to `useNarration`

### Voice Loading UX
- British voice: first use downloads ~64 MB (same as US). Show a `Loader2` spinner next to the voice label in the popover while switching. The active voice label already shows "AI Voice" — update it to show which accent is active when voice is enabled.
- Switching voices mid-playback: stop playback, switch, let user resume manually (same pattern as current toggle).
- Voice preference is saved to `localStorage` so it persists across sessions.

### Data Flow
```text
NarrationControls popover click
  → onVoiceChange('piper-en-alba')
    → Index: setVoiceId()
      → useNarration: setVoice() → setActiveVoice() in tts-engine
        → downloads + loads alba model (if not cached)
        → updates ttsEngine state
          → NarrationControls shows new label
```
