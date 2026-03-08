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

const VOICE_MODEL_BASE = 'https://huggingface.co/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main';
const VOICE_ID = 'piper-en-lessac';
const MODEL_DIR = '/models/piper-en-lessac';

async function fetchBinary(url: string): Promise<Uint8Array> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

/**
 * Initialize TTS engine. Tries RunAnywhere first, falls back to Web Speech API.
 */
export async function initTTS(): Promise<TTSEngine> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ttsState.loading = true;

    try {
      const { RunAnywhere, SDKEnvironment } = await import('@runanywhere/web');
      const { ONNX, TTS, SherpaONNXBridge } = await import('@runanywhere/web-onnx');

      // Set WASM location (copied by vite-plugin-static-copy)
      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!ONNX.isRegistered) {
        await ONNX.register();
      }

      // Ensure WASM module is loaded
      const sherpa = SherpaONNXBridge.shared;
      await sherpa.ensureLoaded();
      console.log('[STORYWORLD] Sherpa-ONNX WASM loaded');

      // Download model files and write them to the WASM virtual filesystem
      console.log('[STORYWORLD] Downloading Piper TTS model files...');
      const [modelData, tokensData] = await Promise.all([
        fetchBinary(`${VOICE_MODEL_BASE}/en_US-lessac-medium.onnx`),
        fetchBinary(`${VOICE_MODEL_BASE}/tokens.txt`),
      ]);
      console.log(`[STORYWORLD] Model: ${(modelData.byteLength / 1e6).toFixed(1)}MB, Tokens: ${(tokensData.byteLength / 1e3).toFixed(1)}KB`);

      // Write files to sherpa-onnx virtual FS
      sherpa.writeFile(`${MODEL_DIR}/model.onnx`, modelData);
      sherpa.writeFile(`${MODEL_DIR}/tokens.txt`, tokensData);
      console.log('[STORYWORLD] Model files written to WASM FS');

      // Load the voice via TTS extension
      await TTS.loadVoice({
        voiceId: VOICE_ID,
        modelPath: `${MODEL_DIR}/model.onnx`,
        tokensPath: `${MODEL_DIR}/tokens.txt`,
        dataDir: '',
        numThreads: 1,
      });

      ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] ✓ RunAnywhere Piper TTS ready');
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
