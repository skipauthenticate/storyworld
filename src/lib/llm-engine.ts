/**
 * STORYWORLD LLM Engine
 * 
 * Uses RunAnywhere Web SDK (@runanywhere/web-llamacpp) for on-device LLM inference
 * with Qwen2.5-0.5B-Instruct model via llama.cpp WASM.
 * Caches the model in IndexedDB to avoid re-downloading.
 */

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
  stateListeners.forEach(fn => fn({ ...llmState }));
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

function getProxyUrl(url: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/cors-proxy?url=${encodeURIComponent(url)}`;
}

// ---- IndexedDB cache helpers ----

function openModelDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
      tx.oncomplete = () => db.close();
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
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[STORYWORLD LLM] Failed to cache model:', err);
  }
}

/**
 * Initialize the on-device LLM. Downloads ~350MB model on first use, caches in IndexedDB.
 */
export async function initLLM(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (llmState.status === 'ready') return true;

  initPromise = (async () => {
    try {
      updateState({ status: 'loading', progress: 0 });

      const { RunAnywhere, SDKEnvironment } = await import('@runanywhere/web');
      const { LlamaCPP, LlamaCppBridge, TextGeneration } = await import('@runanywhere/web-llamacpp');

      LlamaCppBridge.shared.wasmUrl = new URL('/assets/racommons-llamacpp.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!LlamaCPP.isRegistered) {
        await LlamaCPP.register();
      }

      await LlamaCppBridge.shared.ensureLoaded('cpu');
      console.log('[STORYWORLD LLM] llama.cpp WASM loaded');

      // Try loading from IndexedDB cache first
      let modelData = await getCachedModel();

      if (modelData) {
        console.log(`[STORYWORLD LLM] Loaded from cache: ${(modelData.byteLength / 1e6).toFixed(1)}MB`);
        updateState({ status: 'loading', progress: 100 });
      } else {
        // Download model with progress
        updateState({ status: 'downloading', progress: 0 });
        console.log('[STORYWORLD LLM] Downloading Qwen2.5-0.5B (~350MB)...');

        const response = await fetch(getProxyUrl(MODEL_URL));
        if (!response.ok) throw new Error(`Model download failed: ${response.status}`);

        const contentLength = Number(response.headers.get('content-length') || 0);
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            updateState({ progress: Math.round((received / contentLength) * 100) });
          }
        }

        modelData = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          modelData.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`[STORYWORLD LLM] Downloaded: ${(received / 1e6).toFixed(1)}MB`);

        // Cache for next time
        cacheModel(modelData).then(() => {
          console.log('[STORYWORLD LLM] Model cached in IndexedDB');
        });
      }

      // Write to WASM virtual filesystem
      LlamaCppBridge.shared.writeFile(MODEL_FS_PATH, modelData);

      // Load model
      updateState({ status: 'loading', progress: 100 });
      console.log('[STORYWORLD LLM] Loading model into llama.cpp...');
      await TextGeneration.loadModel(MODEL_FS_PATH, MODEL_ID, 'Qwen2.5-0.5B-Instruct');

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

  const { TextGeneration } = await import('@runanywhere/web-llamacpp');
  const prompt = formatChatMLPrompt(messages);

  try {
    const streamResult = await TextGeneration.generateStream(prompt, {
      maxTokens,
      temperature,
    });

    let fullText = '';
    for await (const token of streamResult.stream) {
      if (token) {
        fullText += token;
        onToken?.(token);
      }
    }

    fullText = cleanResponse(fullText);
    onDone?.(fullText);
    return fullText;
  } catch (streamErr) {
    console.warn('[STORYWORLD LLM] Streaming failed, trying non-streaming:', streamErr);
    const result = await TextGeneration.generate(prompt, { maxTokens, temperature });
    const text = cleanResponse(result.text || '');
    onToken?.(text);
    onDone?.(text);
    return text;
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
  import('@runanywhere/web-llamacpp').then(({ TextGeneration }) => {
    TextGeneration.cancel();
  });
}
