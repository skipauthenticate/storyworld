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

// RunAnywhere's pre-packaged tar.gz includes: model.onnx + tokens.txt + espeak-ng-data/
const TTS_ARCHIVE_URL = 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz';
const MODEL_DIR = '/models/piper-en-lessac';

function getProxyUrl(url: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/cors-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Initialize TTS engine. Tries RunAnywhere first, falls back to Web Speech API.
 */
export async function initTTS(): Promise<TTSEngine> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ttsState.loading = true;

    try {
      const { RunAnywhere, SDKEnvironment, extractTarGz } = await import('@runanywhere/web');
      const { ONNX, TTS, SherpaONNXBridge } = await import('@runanywhere/web-onnx');

      // Set WASM location (copied by vite-plugin-static-copy)
      SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!ONNX.isRegistered) {
        await ONNX.register();
      }

      // Ensure WASM is loaded
      const sherpa = SherpaONNXBridge.shared;
      await sherpa.ensureLoaded();
      console.log('[STORYWORLD] Sherpa-ONNX WASM loaded');

      // Download the tar.gz archive
      console.log('[STORYWORLD] Downloading Piper TTS archive (~75MB)...');
      const response = await fetch(getProxyUrl(TTS_ARCHIVE_URL));
      if (!response.ok) throw new Error(`Failed to download TTS archive: ${response.status}`);
      const archiveData = new Uint8Array(await response.arrayBuffer());
      console.log(`[STORYWORLD] Archive downloaded: ${(archiveData.byteLength / 1e6).toFixed(1)}MB`);

      // Extract tar.gz
      console.log('[STORYWORLD] Extracting archive...');
      const entries = await extractTarGz(archiveData);
      console.log(`[STORYWORLD] Extracted ${entries.length} files`);

      // Find the common prefix in the archive (e.g., "vits-piper-en_US-lessac-medium/")
      const prefix = findPrefix(entries.map((e: any) => e.path));

      // Write all files to WASM virtual FS
      let modelPath = '';
      let tokensPath = '';
      let dataDirPath = '';

      for (const entry of entries) {
        const relativePath = prefix ? entry.path.slice(prefix.length) : entry.path;
        if (!relativePath || relativePath.endsWith('/')) continue; // skip directories
        
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

      // Load the voice
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

/** Find common path prefix from archive entry paths */
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
