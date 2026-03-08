/**
 * STORYWORLD TTS Engine
 * 
 * Uses RunAnywhere Web SDK (Piper TTS via sherpa-onnx WASM) for on-device 
 * neural voice synthesis. Falls back to Web Speech API when unavailable.
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

// RunAnywhere's pre-packaged tar.gz that includes model + tokens + espeak-ng-data
const TTS_ARCHIVE_URL = 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz';
const TTS_MODEL_ID = 'vits-piper-en_US-lessac-medium';

/**
 * Initialize TTS engine. Tries RunAnywhere first, falls back to Web Speech API.
 */
export async function initTTS(): Promise<TTSEngine> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ttsState.loading = true;

    try {
      const { RunAnywhere, SDKEnvironment, ModelManager, ModelCategory, ModelStatus } = await import('@runanywhere/web');
      const { ONNX, TTS, SherpaONNXBridge } = await import('@runanywhere/web-onnx');

      // Set WASM location (copied by vite-plugin-static-copy)
      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!ONNX.isRegistered) {
        await ONNX.register();
      }

      // Register TTS model as a tar.gz archive (includes onnx + tokens + espeak-ng-data)
      ModelManager.registerModels([{
        id: TTS_MODEL_ID,
        name: 'Piper TTS EN-US Lessac Medium',
        url: TTS_ARCHIVE_URL,
        modality: ModelCategory.SpeechSynthesis,
        isArchive: true,
      } as any]);

      // Check current status
      const models = ModelManager.getModels();
      const model = models.find((m: any) => m.id === TTS_MODEL_ID);
      console.log(`[STORYWORLD] TTS model status: ${model?.status}`);

      // Download if not already downloaded
      if (!model || model.status === ModelStatus.Registered) {
        console.log('[STORYWORLD] Downloading Piper TTS archive (~65MB with espeak-ng-data)...');
        await ModelManager.downloadModel(TTS_MODEL_ID);
        console.log('[STORYWORLD] TTS archive downloaded');
      } else if (model.status === ModelStatus.Loaded) {
        // Already loaded from a previous session
        ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
        console.log('[STORYWORLD] ✓ Piper TTS already loaded');
        return 'runanywhere' as TTSEngine;
      } else {
        console.log('[STORYWORLD] TTS model already downloaded');
      }

      // Load the model (extracts tar.gz, writes to WASM FS, calls TTS.loadVoice)
      console.log('[STORYWORLD] Loading TTS model (extracting archive → WASM FS)...');
      const loaded = await ModelManager.loadModel(TTS_MODEL_ID, { coexist: true });
      
      if (!loaded) {
        // Try force: re-download and load
        console.warn('[STORYWORLD] loadModel returned false, retrying with fresh download...');
        await ModelManager.downloadModel(TTS_MODEL_ID);
        const retryLoaded = await ModelManager.loadModel(TTS_MODEL_ID, { coexist: true });
        if (!retryLoaded) {
          throw new Error('ModelManager.loadModel failed after retry');
        }
      }

      ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] ✓ RunAnywhere Piper TTS ready (neural voice)');
      return 'runanywhere' as TTSEngine;
    } catch (err) {
      console.warn('[STORYWORLD] RunAnywhere TTS unavailable, falling back:', err);
    }

    // Fallback to Web Speech API
    if ('speechSynthesis' in window) {
      await new Promise<void>((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) resolve();
        else {
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

export async function speakSentence(
  text: string,
  options: { speed?: number; onEnd?: () => void } = {}
): Promise<void> {
  const { speed = 1.0, onEnd } = options;

  if (!ttsState.initialized) await initTTS();
  stopSpeaking();

  if (ttsState.engine === 'runanywhere') {
    try {
      const { TTS, AudioPlayback } = await import('@runanywhere/web-onnx');
      const result = await TTS.synthesize(text, { speed });
      const player = new AudioPlayback();
      await player.play(result.audioData, result.sampleRate);
      player.dispose();
      onEnd?.();
    } catch (err) {
      console.error('[STORYWORLD] Synthesis error, falling back:', err);
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

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function getTTSState(): TTSState {
  return { ...ttsState };
}
