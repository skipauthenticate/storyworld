/**
 * STORYWORLD LLM Engine
 *
 * Uses RunAnywhere Web SDK (@runanywhere/web-llamacpp) for on-device LLM inference
 * with Qwen2.5-0.5B-Instruct model via llama.cpp WASM.
 *
 * Attempts to use ModelManager (OPFS) for model caching. Falls back to manual
 * IndexedDB caching if ModelManager is unavailable.
 * Enables WebGPU acceleration when available, falls back to CPU.
 */

import { getProxyUrl, fetchWithTimeout, getSDKEnvironment, DOWNLOAD_TIMEOUT_MS } from './runanywhere-common';

export type LLMEngineStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface LLMState {
  status: LLMEngineStatus;
  progress: number;
  error: string | null;
}

let llmState: LLMState = { status: 'idle', progress: 0, error: null };
let initPromise: Promise<boolean> | null = null;
const stateListeners: Set<(state: LLMState) => void> = new Set();

function updateState(partial: Partial<LLMState>) {
  llmState = { ...llmState, ...partial };
  stateListeners.forEach(fn => {
    try { fn({ ...llmState }); } catch (_) { /* listener error ignored */ }
  });
}

export function onLLMStateChange(fn: (state: LLMState) => void) {
  stateListeners.add(fn);
  return () => { stateListeners.delete(fn); };
}

export function getLLMState(): LLMState {
  return { ...llmState };
}

const MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf';
const MODEL_ID = 'qwen2.5-0.5b';
const MODEL_FS_PATH = '/models/qwen2.5-0.5b-instruct-q4_0.gguf';
const IDB_DB_NAME = 'storyworld-models';
const IDB_STORE_NAME = 'models';
const IDB_KEY = 'qwen2.5-0.5b-instruct-q4_0';

// ---- IndexedDB cache helpers (fallback when ModelManager unavailable) ----

let cachedModelDB: IDBDatabase | null = null;

function openModelDB(): Promise<IDBDatabase> {
  if (cachedModelDB) {
    try {
      if (cachedModelDB.objectStoreNames.contains(IDB_STORE_NAME)) {
        return Promise.resolve(cachedModelDB);
      }
    } catch {
      cachedModelDB = null;
    }
  }
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE_NAME);
      };
      req.onsuccess = () => {
        cachedModelDB = req.result;
        cachedModelDB.onclose = () => { cachedModelDB = null; };
        resolve(cachedModelDB);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function getCachedModel(): Promise<Uint8Array | null> {
  try {
    const db = await openModelDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheModel(data: Uint8Array): Promise<void> {
  try {
    const db = await openModelDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[STORYWORLD LLM] Failed to cache model:', err);
  }
}

// ---- ModelManager integration (preferred, uses OPFS) ----

async function tryModelManager(llamaMod: any): Promise<boolean> {
  try {
    const { ModelManager, EventBus } = llamaMod;
    if (!ModelManager) return false;

    // Listen for download progress via EventBus
    const unsub = EventBus?.on?.('model:download:progress', (event: any) => {
      if (event?.modelId === MODEL_ID) {
        updateState({ progress: Math.round((event.progress ?? 0) * 100) });
      }
    });

    // Check if model is already downloaded
    const isDownloaded = await ModelManager.isDownloaded?.(MODEL_ID);

    if (isDownloaded) {
      console.log('[STORYWORLD LLM] Model found in OPFS cache');
      updateState({ status: 'loading', progress: 100 });
    } else {
      updateState({ status: 'downloading', progress: 0 });
      console.log('[STORYWORLD LLM] Downloading Qwen2.5-0.5B via ModelManager...');
      await ModelManager.downloadModel(MODEL_ID);
    }

    updateState({ status: 'loading', progress: 100 });
    console.log('[STORYWORLD LLM] Loading model via ModelManager...');
    await ModelManager.loadModel(MODEL_ID);

    if (typeof unsub === 'function') unsub();
    return true;
  } catch (err) {
    console.warn('[STORYWORLD LLM] ModelManager unavailable, falling back to manual download:', err);
    return false;
  }
}

// ---- Manual download + IndexedDB cache (fallback) ----

async function manualDownloadAndLoad(LlamaCppBridge: any, TextGeneration: any): Promise<void> {
  let modelData = await getCachedModel();

  if (modelData) {
    console.log(`[STORYWORLD LLM] Loaded from IndexedDB cache: ${(modelData.byteLength / 1e6).toFixed(1)}MB`);
    updateState({ status: 'loading', progress: 100 });
  } else {
    updateState({ status: 'downloading', progress: 0 });
    console.log('[STORYWORLD LLM] Downloading Qwen2.5-0.5B (~350MB)...');

    const response = await fetchWithTimeout(getProxyUrl(MODEL_URL), DOWNLOAD_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Model download failed: ${response.status}`);

    if (!response.body) {
      throw new Error('Download response has no body — browser may not support streaming');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            updateState({ progress: Math.round((received / contentLength) * 100) });
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch (_) { /* ignore */ }
    }

    if (received === 0) throw new Error('Downloaded 0 bytes — check network connection');

    modelData = new Uint8Array(received);
    let offset = 0;
    let bytesSinceYield = 0;
    for (const chunk of chunks) {
      modelData.set(chunk, offset);
      offset += chunk.length;
      bytesSinceYield += chunk.length;
      // Yield every ~50MB to prevent main thread blocking during large assembly
      if (bytesSinceYield >= 50 * 1024 * 1024) {
        bytesSinceYield = 0;
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Final yield after assembly
    await new Promise(r => setTimeout(r, 0));

    console.log(`[STORYWORLD LLM] Downloaded: ${(received / 1e6).toFixed(1)}MB`);

    // Cache for next time (fire-and-forget)
    cacheModel(modelData).then(() => {
      console.log('[STORYWORLD LLM] Model cached in IndexedDB');
    }).catch(() => { /* caching failure is non-fatal */ });
  }

  // Write to WASM virtual filesystem
  LlamaCppBridge.shared.writeFile(MODEL_FS_PATH, modelData);

  // Load model
  updateState({ status: 'loading', progress: 100 });
  console.log('[STORYWORLD LLM] Loading model into llama.cpp...');
  await TextGeneration.loadModel(MODEL_FS_PATH, MODEL_ID, 'Qwen2.5-0.5B-Instruct', { coexist: true });
}

/**
 * Initialize the on-device LLM. Downloads ~350MB model on first use, caches in OPFS/IndexedDB.
 * Enables WebGPU acceleration when available.
 */
export async function initLLM(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (llmState.status === 'ready') return true;

  initPromise = (async () => {
    try {
      updateState({ status: 'loading', progress: 0 });

      let RunAnywhere: any;
      try {
        const webMod = await import('@runanywhere/web');
        RunAnywhere = webMod.RunAnywhere;
      } catch (importErr) {
        throw new Error(`Failed to load RunAnywhere SDK: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
      }

      let LlamaCPP: any, LlamaCppBridge: any, TextGeneration: any, llamaMod: any;
      try {
        llamaMod = await import('@runanywhere/web-llamacpp');
        LlamaCPP = llamaMod.LlamaCPP;
        LlamaCppBridge = llamaMod.LlamaCppBridge;
        TextGeneration = llamaMod.TextGeneration;
      } catch (importErr) {
        throw new Error(`Failed to load llama.cpp module: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
      }

      LlamaCppBridge.shared.wasmUrl = new URL('/assets/racommons-llamacpp.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        const environment = await getSDKEnvironment();
        await RunAnywhere.initialize({ environment, debug: false });
      }
      if (!LlamaCPP.isRegistered) {
        await LlamaCPP.register();
      }

      // Enable WebGPU if available, fall back to CPU
      let accelMode = 'cpu';
      try {
        accelMode = LlamaCPP.accelerationMode || 'cpu';
        console.log(`[STORYWORLD LLM] Acceleration mode: ${accelMode}`);
      } catch {
        console.log('[STORYWORLD LLM] Could not detect acceleration mode, using CPU');
      }
      await LlamaCppBridge.shared.ensureLoaded(accelMode);
      console.log('[STORYWORLD LLM] llama.cpp WASM loaded');

      // Try ModelManager first (OPFS-based caching), fall back to manual IndexedDB
      const usedModelManager = await tryModelManager(llamaMod);
      if (!usedModelManager) {
        await manualDownloadAndLoad(LlamaCppBridge, TextGeneration);
      }

      updateState({ status: 'ready', progress: 100, error: null });
      console.log('[STORYWORLD LLM] ✓ Qwen2.5-0.5B ready for inference');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[STORYWORLD LLM] Init failed:', err);
      updateState({ status: 'error', error: msg });
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Generate a chat response using the on-device LLM with streaming.
 */
export async function chatGenerate(
  messages: ChatMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
    onToken?: (token: string) => void;
    onDone?: (fullText: string) => void;
  } = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.7, onToken, onDone } = options;

  if (llmState.status !== 'ready') {
    const ok = await initLLM();
    if (!ok) throw new Error('LLM engine not available');
  }

  let TextGeneration: any;
  try {
    const mod = await import('@runanywhere/web-llamacpp');
    TextGeneration = mod.TextGeneration;
  } catch (importErr) {
    throw new Error(`Failed to load llama.cpp for generation: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
  }

  const prompt = formatChatMLPrompt(messages);

  try {
    const streamResult = await TextGeneration.generateStream(prompt, {
      maxTokens,
      temperature,
    });

    let fullText = '';
    let tokenCount = 0;
    for await (const token of streamResult.stream) {
      if (token) {
        fullText += token;
        tokenCount++;
        try { onToken?.(token); } catch (_) { /* callback error ignored */ }

        // Yield periodically so long generations don't starve the UI thread
        if (tokenCount % 24 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    fullText = cleanResponse(fullText);
    try { onDone?.(fullText); } catch (_) { /* callback error ignored */ }
    return fullText;
  } catch (streamErr) {
    console.warn('[STORYWORLD LLM] Streaming failed, trying non-streaming:', streamErr);
    try {
      const result = await TextGeneration.generate(prompt, { maxTokens, temperature });
      const text = cleanResponse(result.text || '');
      try { onToken?.(text); } catch (_) { /* ignored */ }
      try { onDone?.(text); } catch (_) { /* ignored */ }
      return text;
    } catch (fallbackErr) {
      throw new Error(`LLM generation failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
    }
  }
}

function formatChatMLPrompt(messages: ChatMessage[]): string {
  let prompt = '';
  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

function cleanResponse(text: string): string {
  return text
    .replace(/<\|im_end\|>.*$/s, '')
    .replace(/<\|im_start\|>.*$/s, '')
    .trim();
}

export function cancelGeneration() {
  try {
    import('@runanywhere/web-llamacpp').then(({ TextGeneration }) => {
      try { TextGeneration.cancel(); } catch (_) { /* ignore */ }
    }).catch(() => { /* module not loaded, nothing to cancel */ });
  } catch (_) {
    /* ignore */
  }
}
