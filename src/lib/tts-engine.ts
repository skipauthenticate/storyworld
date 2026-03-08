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
let currentPlayer: { dispose: () => void } | null = null;

const TTS_ARCHIVE_URL = 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz';
const MODEL_DIR = '/models/piper-en-lessac';
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function getProxyUrl(url: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('[STORYWORLD TTS] No VITE_SUPABASE_URL, using direct URL');
    return url;
  }
  return `${supabaseUrl}/functions/v1/cors-proxy?url=${encodeURIComponent(url)}`;
}

/** Helper: fetch with timeout */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Initialize TTS engine. Tries RunAnywhere first, falls back to Web Speech API.
 */
export async function initTTS(): Promise<TTSEngine> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ttsState.loading = true;

    try {
      let RunAnywhere: any, SDKEnvironment: any, extractTarGz: any;
      let ONNX: any, TTS: any, SherpaONNXBridge: any;

      try {
        const webMod = await import('@runanywhere/web');
        RunAnywhere = webMod.RunAnywhere;
        SDKEnvironment = webMod.SDKEnvironment;
        extractTarGz = webMod.extractTarGz;
      } catch (err) {
        throw new Error(`Failed to load RunAnywhere SDK: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        const onnxMod = await import('@runanywhere/web-onnx');
        ONNX = onnxMod.ONNX;
        TTS = onnxMod.TTS;
        SherpaONNXBridge = onnxMod.SherpaONNXBridge;
      } catch (err) {
        throw new Error(`Failed to load ONNX module: ${err instanceof Error ? err.message : String(err)}`);
      }

      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!ONNX.isRegistered) {
        await ONNX.register();
      }

      const sherpa = SherpaONNXBridge.shared;
      await sherpa.ensureLoaded();
      console.log('[STORYWORLD] Sherpa-ONNX WASM loaded');

      console.log('[STORYWORLD] Downloading Piper TTS archive (~75MB)...');
      const response = await fetchWithTimeout(getProxyUrl(TTS_ARCHIVE_URL), DOWNLOAD_TIMEOUT_MS);
      if (!response.ok) throw new Error(`Failed to download TTS archive: ${response.status}`);
      const archiveData = new Uint8Array(await response.arrayBuffer());
      console.log(`[STORYWORLD] Archive downloaded: ${(archiveData.byteLength / 1e6).toFixed(1)}MB`);

      if (archiveData.byteLength === 0) throw new Error('Downloaded empty TTS archive');

      console.log('[STORYWORLD] Extracting archive...');
      let entries: any[];
      try {
        entries = await extractTarGz(archiveData);
      } catch (extractErr) {
        throw new Error(`Failed to extract TTS archive: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`);
      }
      console.log(`[STORYWORLD] Extracted ${entries.length} files`);

      const prefix = findPrefix(entries.map((e: any) => e.path));

      let modelPath = '';
      let tokensPath = '';
      let dataDirPath = '';

      for (const entry of entries) {
        const relativePath = prefix ? entry.path.slice(prefix.length) : entry.path;
        if (!relativePath || relativePath.endsWith('/')) continue;
        
        const fsPath = `${MODEL_DIR}/${relativePath}`;
        sherpa.writeFile(fsPath, entry.data);

        if (relativePath.endsWith('.onnx') && !relativePath.includes('/')) {
          modelPath = fsPath;
        }
        if (relativePath === 'tokens.txt') {
          tokensPath = fsPath;
        }
        if (relativePath.startsWith('espeak-ng-data/') && !dataDirPath) {
          dataDirPath = `${MODEL_DIR}/espeak-ng-data`;
        }
      }

      console.log(`[STORYWORLD] Model: ${modelPath}, Tokens: ${tokensPath}, DataDir: ${dataDirPath}`);

      if (!modelPath) throw new Error('No .onnx model file found in archive');
      if (!tokensPath) throw new Error('No tokens.txt found in archive');

      console.log('[STORYWORLD] Loading TTS voice...');
      await TTS.loadVoice({
        voiceId: 'piper-en-lessac',
        modelPath,
        tokensPath,
        dataDir: dataDirPath,
        numThreads: 1,
      });

      ttsState = { engine: 'runanywhere', initialized: true, loading: false, error: null };
      console.log('[STORYWORLD] ✓ RunAnywhere Piper TTS ready (neural voice)');
      return 'runanywhere' as TTSEngine;
    } catch (err) {
      console.warn('[STORYWORLD] RunAnywhere TTS unavailable, falling back:', err);
    }

    // Fallback to Web Speech API
    try {
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
    } catch (wsErr) {
      console.warn('[STORYWORLD] Web Speech API init failed:', wsErr);
    }

    ttsState = { engine: 'none', initialized: true, loading: false, error: 'No TTS engine available' };
    return 'none' as TTSEngine;
  })();

  return initPromise;
}

function findPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const first = paths[0];
  const slashIdx = first.indexOf('/');
  if (slashIdx < 0) return '';
  const candidate = first.slice(0, slashIdx + 1);
  if (paths.every(p => p.startsWith(candidate))) return candidate;
  return '';
}

export async function speakSentence(
  text: string,
  options: { speed?: number; onEnd?: () => void } = {}
): Promise<void> {
  const { speed = 1.0, onEnd } = options;

  try {
    if (!ttsState.initialized) await initTTS();
  } catch (initErr) {
    console.warn('[STORYWORLD] TTS init failed during speak:', initErr);
    onEnd?.();
    return;
  }

  try {
    stopSpeaking();
  } catch (_) { /* ignore stop errors */ }

  if (ttsState.engine === 'runanywhere') {
    try {
      const { TTS, AudioPlayback } = await import('@runanywhere/web-onnx');
      const result = await TTS.synthesize(text, { speed });
      const player = new AudioPlayback();
      currentPlayer = player;
      
      try {
        await player.play(result.audioData, result.sampleRate);
      } catch (playErr: any) {
        // Handle autoplay policy blocking
        if (playErr?.name === 'NotAllowedError') {
          console.warn('[STORYWORLD] Autoplay blocked — user gesture required');
          currentPlayer = null;
          try { player.dispose(); } catch (_) {}
          // Fall back to Web Speech which is more lenient
          speakWithWebSpeech(text, speed, onEnd);
          return;
        }
        throw playErr;
      }
      
      currentPlayer = null;
      try { player.dispose(); } catch (_) {}
      onEnd?.();
    } catch (err) {
      console.error('[STORYWORLD] Synthesis error, falling back:', err);
      currentPlayer = null;
      speakWithWebSpeech(text, speed, onEnd);
    }
  } else if (ttsState.engine === 'webspeech') {
    speakWithWebSpeech(text, speed, onEnd);
  } else {
    onEnd?.();
  }
}

function speakWithWebSpeech(text: string, speed: number, onEnd?: () => void) {
  try {
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
  } catch (err) {
    console.warn('[STORYWORLD] Web Speech speak failed:', err);
    onEnd?.();
  }
}

export function stopSpeaking() {
  // Stop RunAnywhere AudioPlayback
  if (currentPlayer) {
    try {
      currentPlayer.dispose();
    } catch (_) {}
    currentPlayer = null;
  }
  // Stop Web Speech API
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch (_) {}
}

export function getTTSState(): TTSState {
  return { ...ttsState };
}
