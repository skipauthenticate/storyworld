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

const VOICE_MODEL_URL = 'https://huggingface.co/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main/en_US-lessac-medium.onnx';
const TOKENS_URL = 'https://huggingface.co/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main/tokens.txt';

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

      // Point the bridge to the correct WASM location (copied by vite-plugin-static-copy)
      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
        debug: true,
      });

      await ONNX.register();

      // Register the TTS model in the catalog
      ModelManager.registerModels([{
        id: TTS_MODEL_ID,
        name: 'Piper EN US Lessac Medium',
        url: VOICE_MODEL_URL,
        modality: ModelCategory.SpeechSynthesis,
        additionalFiles: [
          { filename: 'tokens.txt', url: TOKENS_URL },
        ],
      } as any]);

      // Check if already downloaded
      const models = ModelManager.getModels();
      const ttsModel = models.find((m: any) => m.id === TTS_MODEL_ID);
      
      if (!ttsModel || ttsModel.status === ModelStatus.Registered) {
        console.log('[STORYWORLD] Downloading TTS model...');
        await ModelManager.downloadModel(TTS_MODEL_ID);
        console.log('[STORYWORLD] TTS model downloaded');
      }

      // Load the model (this writes to WASM FS and calls TTS.loadVoice)
      console.log('[STORYWORLD] Loading TTS model...');
      await ModelManager.loadModel(TTS_MODEL_ID, { coexist: true });
      console.log('[STORYWORLD] TTS model loaded');

      ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] RunAnywhere TTS initialized (Piper neural voice)');
      return 'runanywhere' as TTSEngine;
    } catch (err) {
      console.warn('[STORYWORLD] RunAnywhere TTS unavailable, trying Web Speech API:', err);
    }

    // Fallback to Web Speech API
    if ('speechSynthesis' in window) {
      // Ensure voices are loaded
      await new Promise<void>((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve();
        } else {
          speechSynthesis.onvoiceschanged = () => resolve();
          // Timeout in case event never fires
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
      const player = new AudioPlayback();
      await player.play(result.audioData, result.sampleRate);
      player.dispose();
      onEnd?.();
    } catch (err) {
      console.error('[STORYWORLD] RunAnywhere TTS synthesis error, falling back:', err);
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

  // Try to pick a good English voice
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
