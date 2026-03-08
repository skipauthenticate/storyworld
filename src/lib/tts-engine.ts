/**
 * STORYWORLD TTS Engine
 * 
 * Uses RunAnywhere Web SDK (Piper TTS via sherpa-onnx WASM) for on-device 
 * neural voice synthesis. Falls back to Web Speech API when RunAnywhere 
 * is unavailable.
 */

export type TTSEngine = 'runanywhere' | 'webspeech' | 'none';

interface TTSState {
  engine: TTSEngine;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

let ttsState: TTSState = {
  engine: 'none',
  initialized: false,
  loading: false,
  error: null,
};

let initPromise: Promise<TTSEngine> | null = null;

const VOICE_MODEL_BASE = 'https://huggingface.co/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main';
const TTS_MODEL_ID = 'piper-en-lessac-medium';

/**
 * Initialize TTS engine. Tries RunAnywhere first, falls back to Web Speech API.
 */
export async function initTTS(): Promise<TTSEngine> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ttsState.loading = true;

    // Try RunAnywhere first
    try {
      const { RunAnywhere, SDKEnvironment, ModelManager, ModelCategory, ModelStatus } = await import('@runanywhere/web');
      const { ONNX, TTS, SherpaONNXBridge } = await import('@runanywhere/web-onnx');

      // Point the bridge to the correct WASM location
      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({
          environment: SDKEnvironment.Development,
          debug: false,
        });
      }

      if (!ONNX.isRegistered) {
        await ONNX.register();
      }

      // Register the TTS model in the catalog
      ModelManager.registerModels([{
        id: TTS_MODEL_ID,
        name: 'Piper EN US Lessac Medium',
        url: `${VOICE_MODEL_BASE}/en_US-lessac-medium.onnx`,
        modality: ModelCategory.SpeechSynthesis,
        additionalFiles: [
          { filename: 'tokens.txt', url: `${VOICE_MODEL_BASE}/tokens.txt` },
        ],
      } as any]);

      // Download if needed
      const model = ModelManager.getModels().find((m: any) => m.id === TTS_MODEL_ID);
      if (!model || model.status === ModelStatus.Registered) {
        console.log('[STORYWORLD] Downloading TTS model (~65MB)...');
        await ModelManager.downloadModel(TTS_MODEL_ID);
        console.log('[STORYWORLD] TTS model downloaded');
      } else {
        console.log('[STORYWORLD] TTS model already downloaded, status:', model.status);
      }

      // Load the model (writes files to WASM FS and calls TTS.loadVoice internally)
      const currentModel = ModelManager.getModels().find((m: any) => m.id === TTS_MODEL_ID);
      if (currentModel?.status !== ModelStatus.Loaded) {
        console.log('[STORYWORLD] Loading TTS model into WASM...');
        const loaded = await ModelManager.loadModel(TTS_MODEL_ID, { coexist: true });
        if (!loaded) {
          throw new Error(`ModelManager.loadModel returned false for ${TTS_MODEL_ID}`);
        }
        console.log('[STORYWORLD] TTS model loaded into WASM');
      }

      // Verify TTS is actually ready by checking the extension
      // TTS.synthesize will throw if _ttsHandle === 0
      // We trust loadModel succeeded if we got here

      ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] ✓ RunAnywhere TTS initialized (Piper neural voice)');
      return 'runanywhere' as TTSEngine;
    } catch (err) {
      console.warn('[STORYWORLD] RunAnywhere TTS unavailable, trying Web Speech API:', err);
    }

    // Fallback to Web Speech API
    if ('speechSynthesis' in window) {
      await new Promise<void>((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve();
        } else {
          speechSynthesis.onvoiceschanged = () => resolve();
          setTimeout(resolve, 1000);
        }
      });

      ttsState = { engine: 'webspeech', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] Using Web Speech API fallback');
      return 'webspeech' as TTSEngine;
    }

    ttsState = { engine: 'none', initialized: true, loading: false, error: 'No TTS engine available' };
    return 'none' as TTSEngine;
  })();

  return initPromise;
}

/**
 * Synthesize and play a sentence. Returns a promise that resolves when speech ends.
 */
export async function speakSentence(
  text: string,
  options: { speed?: number; onEnd?: () => void } = {}
): Promise<void> {
  const { speed = 1.0, onEnd } = options;

  if (!ttsState.initialized) {
    await initTTS();
  }

  // Stop any current speech
  stopSpeaking();

  if (ttsState.engine === 'runanywhere') {
    try {
      const { TTS, AudioPlayback } = await import('@runanywhere/web-onnx');
      const result = await TTS.synthesize(text, { speed });
      
      return new Promise<void>((resolve) => {
        const player = new AudioPlayback();
        player.play(result.audioData, result.sampleRate).then(() => {
          player.dispose();
          onEnd?.();
          resolve();
        }).catch((err: any) => {
          console.error('[STORYWORLD] AudioPlayback error:', err);
          player.dispose();
          onEnd?.();
          resolve();
        });
      });
    } catch (err) {
      console.error('[STORYWORLD] RunAnywhere TTS synthesis error, falling back:', err);
      // Fall back to web speech for this sentence
      speakWithWebSpeech(text, speed, onEnd);
    }
  } else if (ttsState.engine === 'webspeech') {
    speakWithWebSpeech(text, speed, onEnd);
  } else {
    onEnd?.();
  }
}

function speakWithWebSpeech(text: string, speed: number, onEnd?: () => void) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Google US'))
  ) || voices.find((v) => v.lang.startsWith('en') && v.localService);
  if (preferred) utterance.voice = preferred;

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  speechSynthesis.speak(utterance);
}

/**
 * Stop any current speech.
 */
export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

/**
 * Get current TTS state.
 */
export function getTTSState(): TTSState {
  return { ...ttsState };
}
