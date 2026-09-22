/**
 * STORYWORLD TTS Engine
 *
 * Uses RunAnywhere Web SDK (Piper TTS via sherpa-onnx WASM) for on-device
 * neural voice synthesis. Falls back to Web Speech API when unavailable.
 */

import { getProxyUrl, fetchWithTimeout, getSDKEnvironment, DOWNLOAD_TIMEOUT_MS } from './runanywhere-common';

export type TTSEngine = 'runanywhere' | 'webspeech' | 'none';
export type VoiceId = 'piper-en-lessac' | 'piper-en-alba' | 'webspeech';

export interface VoiceOption {
  id: VoiceId;
  label: string;
  accent: string;
  engine: TTSEngine;
  /** Size hint shown in UI */
  sizeHint?: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: 'piper-en-lessac', label: 'AI Voice', accent: 'US', engine: 'runanywhere', sizeHint: '~64MB' },
  { id: 'piper-en-alba',   label: 'AI Voice', accent: 'British', engine: 'runanywhere', sizeHint: '~64MB' },
  { id: 'webspeech',       label: 'System Voice', accent: '', engine: 'webspeech' },
];

interface VoiceConfig {
  archiveUrl: string;
  modelDir: string;
  voiceId: string;
}

type PiperVoiceId = 'piper-en-lessac' | 'piper-en-alba';

const VOICE_CONFIGS: Record<PiperVoiceId, VoiceConfig> = {
  'piper-en-lessac': {
    archiveUrl: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    modelDir: '/models/piper-en-lessac',
    voiceId: 'piper-en-lessac',
  },
  'piper-en-alba': {
    archiveUrl: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_GB-alba-medium.tar.gz',
    modelDir: '/models/piper-en-alba',
    voiceId: 'piper-en-alba',
  },
};

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

// Per-voice init promises (cached after first load)
const voiceInitPromises: Partial<Record<VoiceId, Promise<TTSEngine>>> = {};
let activeVoiceId: VoiceId = 'piper-en-lessac';
let sdkBooted = false; // RunAnywhere + ONNX only need to boot once

let currentPlayer: { dispose: () => void } | null = null;
let speakGeneration = 0;

// ---- Voice archive caching (IndexedDB) ----

const VOICE_DB_NAME = 'storyworld-voices';
const VOICE_STORE_NAME = 'archives';
let cachedVoiceDB: IDBDatabase | null = null;

function openVoiceDB(): Promise<IDBDatabase> {
  if (cachedVoiceDB) {
    try {
      if (cachedVoiceDB.objectStoreNames.contains(VOICE_STORE_NAME)) {
        return Promise.resolve(cachedVoiceDB);
      }
    } catch {
      cachedVoiceDB = null;
    }
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VOICE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(VOICE_STORE_NAME);
    };
    req.onsuccess = () => {
      cachedVoiceDB = req.result;
      cachedVoiceDB.onclose = () => { cachedVoiceDB = null; };
      resolve(cachedVoiceDB);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getCachedVoice(voiceKey: string): Promise<Uint8Array | null> {
  try {
    const db = await openVoiceDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VOICE_STORE_NAME, 'readonly');
      const store = tx.objectStore(VOICE_STORE_NAME);
      const req = store.get(voiceKey);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheVoice(voiceKey: string, data: Uint8Array): Promise<void> {
  try {
    const db = await openVoiceDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VOICE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VOICE_STORE_NAME);
      store.put(data, voiceKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[STORYWORLD TTS] Failed to cache voice:', err);
  }
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

async function bootSDK(): Promise<{ TTS: any; SherpaONNXBridge: any; extractTarGz: any }> {
  const webMod = await import('@runanywhere/web');
  const { RunAnywhere, extractTarGz } = webMod;

  const onnxMod = await import('@runanywhere/web-onnx');
  const { ONNX, TTS, SherpaONNXBridge } = onnxMod;

  SherpaONNXBridge.shared.wasmUrl = new URL('/assets/sherpa-onnx-glue.js', window.location.origin).href;

  if (!RunAnywhere.isInitialized) {
    const environment = await getSDKEnvironment();
    await RunAnywhere.initialize({ environment, debug: false });
  }
  if (!ONNX.isRegistered) {
    await ONNX.register();
  }

  const sherpa = SherpaONNXBridge.shared;
  await sherpa.ensureLoaded();

  sdkBooted = true;
  return { TTS, SherpaONNXBridge, extractTarGz };
}

async function loadPiperVoice(voiceKey: PiperVoiceId): Promise<TTSEngine> {
  const config = VOICE_CONFIGS[voiceKey];

  const { TTS, SherpaONNXBridge, extractTarGz } = await bootSDK();
  const sherpa = SherpaONNXBridge.shared;

  // Try loading from IndexedDB cache first
  let archiveData = await getCachedVoice(voiceKey);

  if (archiveData) {
    console.log(`[STORYWORLD] Voice "${voiceKey}" loaded from cache (${(archiveData.byteLength / 1e6).toFixed(1)}MB)`);
  } else {
    console.log(`[STORYWORLD] Downloading Piper voice "${voiceKey}" (~67MB)...`);
    const response = await fetchWithTimeout(getProxyUrl(config.archiveUrl), DOWNLOAD_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Failed to download TTS archive: ${response.status}`);

    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) { chunks.push(value); received += value.length; }
        }
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }
      archiveData = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { archiveData.set(chunk, offset); offset += chunk.length; }
      await new Promise(r => setTimeout(r, 0));
    } else {
      archiveData = new Uint8Array(await response.arrayBuffer());
    }

    if (archiveData.byteLength === 0) throw new Error('Downloaded empty TTS archive');

    // Cache for next time (fire-and-forget)
    cacheVoice(voiceKey, archiveData).then(() => {
      console.log(`[STORYWORLD] Voice "${voiceKey}" cached in IndexedDB`);
    }).catch(() => { /* caching failure is non-fatal */ });
  }

  console.log(`[STORYWORLD] Extracting ${voiceKey} archive...`);
  let entries: any[];
  try {
    entries = await extractTarGz(archiveData);
  } catch (extractErr) {
    throw new Error(`Failed to extract TTS archive: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`);
  }

  const prefix = findPrefix(entries.map((e: any) => e.path));
  let modelPath = '';
  let tokensPath = '';
  let dataDirPath = '';

  for (const entry of entries) {
    const relativePath = prefix ? entry.path.slice(prefix.length) : entry.path;
    if (!relativePath || relativePath.endsWith('/')) continue;
    const fsPath = `${config.modelDir}/${relativePath}`;
    sherpa.writeFile(fsPath, entry.data);
    if (relativePath.endsWith('.onnx') && !relativePath.includes('/')) modelPath = fsPath;
    if (relativePath === 'tokens.txt') tokensPath = fsPath;
    if (relativePath.startsWith('espeak-ng-data/') && !dataDirPath) dataDirPath = `${config.modelDir}/espeak-ng-data`;
  }

  if (!modelPath) throw new Error('No .onnx model file found in archive');
  if (!tokensPath) throw new Error('No tokens.txt found in archive');

  await TTS.loadVoice({
    voiceId: config.voiceId,
    modelPath,
    tokensPath,
    dataDir: dataDirPath,
    numThreads: 1,
  });

  console.log(`[STORYWORLD] ✓ Voice "${voiceKey}" loaded`);
  return 'runanywhere';
}

/**
 * Initialize TTS engine. Tries RunAnywhere first (with specified voice), falls back to Web Speech API.
 */
export async function initTTS(voiceId: VoiceId = 'piper-en-lessac'): Promise<TTSEngine> {
  return setActiveVoice(voiceId);
}

/**
 * Switch to a different voice. Downloads and caches the model if not already loaded.
 * Returns the resulting TTSEngine.
 */
export async function setActiveVoice(voiceId: VoiceId): Promise<TTSEngine> {
  activeVoiceId = voiceId;

  if (voiceId === 'webspeech') {
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
        return 'webspeech';
      }
    } catch (wsErr) {
      console.warn('[STORYWORLD] Web Speech API init failed:', wsErr);
    }
    ttsState = { engine: 'none', initialized: true, loading: false, error: 'Web Speech not available' };
    return 'none';
  }

  // Piper voice — use cached promise if already loading/loaded
  if (!voiceInitPromises[voiceId]) {
    voiceInitPromises[voiceId] = (async () => {
      ttsState.loading = true;
      try {
        const engine = await loadPiperVoice(voiceId as PiperVoiceId);
        ttsState = { engine, initialized: true, loading: false, error: null };
        return engine;
      } catch (err) {
        console.warn('[STORYWORLD] RunAnywhere TTS unavailable, falling back to Web Speech:', err);
        // Fallback
        try {
          if ('speechSynthesis' in window) {
            ttsState = { engine: 'webspeech', initialized: true, loading: false, error: null };
            return 'webspeech' as TTSEngine;
          }
        } catch (_) {}
        ttsState = { engine: 'none', initialized: true, loading: false, error: 'No TTS engine available' };
        return 'none' as TTSEngine;
      }
    })();
  }

  return voiceInitPromises[voiceId]!;
}

export async function speakSentence(
  text: string,
  options: { speed?: number; onEnd?: () => void } = {}
): Promise<void> {
  const { speed = 1.0, onEnd } = options;
  const thisGen = ++speakGeneration;

  try {
    if (!ttsState.initialized) await setActiveVoice(activeVoiceId);
  } catch (initErr) {
    console.warn('[STORYWORLD] TTS init failed during speak:', initErr);
    onEnd?.();
    return;
  }

  try {
    stopSpeakingInternal();
  } catch (_) { /* ignore stop errors */ }

  if (thisGen !== speakGeneration) { onEnd?.(); return; }

  if (ttsState.engine === 'runanywhere') {
    try {
      const onnxMod = await import('@runanywhere/web-onnx');
      const TTS = onnxMod.TTS;
      if (thisGen !== speakGeneration) { onEnd?.(); return; }
      const result = await TTS.synthesize(text, { speed });
      if (thisGen !== speakGeneration) { onEnd?.(); return; }

      // Play audio using AudioContext
      const audioCtx = new AudioContext({ sampleRate: result.sampleRate });
      const buffer = audioCtx.createBuffer(1, result.audioData.length, result.sampleRate);
      buffer.getChannelData(0).set(result.audioData);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1.0; // speed already applied by TTS
      source.connect(audioCtx.destination);

      const player = {
        dispose: () => { try { source.stop(); audioCtx.close(); } catch (_) {} },
      };
      currentPlayer = player;

      try {
        await new Promise<void>((resolve, reject) => {
          source.onended = () => resolve();
          try { source.start(); } catch (e) { reject(e); }
        });
      } catch (playErr: any) {
        if (playErr?.name === 'NotAllowedError') {
          console.warn('[STORYWORLD] Autoplay blocked — user gesture required');
          currentPlayer = null;
          try { player.dispose(); } catch (_) {}
          speakWithWebSpeech(text, speed, onEnd);
          return;
        }
        throw playErr;
      }

      currentPlayer = null;
      try { player.dispose(); } catch (_) {}
      if (thisGen === speakGeneration) onEnd?.();
    } catch (err) {
      console.error('[STORYWORLD] Synthesis error, falling back:', err);
      currentPlayer = null;
      if (thisGen === speakGeneration) speakWithWebSpeech(text, speed, onEnd);
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

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(watchdog);
      onEnd?.();
    };

    const words = text.split(/\s+/).length;
    const estimatedSec = (words / (150 * Math.max(speed, 0.5))) * 60;
    const watchdog = setTimeout(finish, (estimatedSec + 5) * 1000);

    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[STORYWORLD] Web Speech speak failed:', err);
    onEnd?.();
  }
}

function stopSpeakingInternal() {
  if (currentPlayer) {
    try { currentPlayer.dispose(); } catch (_) {}
    currentPlayer = null;
  }
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch (_) {}
}

export function stopSpeaking() {
  speakGeneration++;
  stopSpeakingInternal();
}

export function getTTSState(): TTSState {
  return { ...ttsState };
}
