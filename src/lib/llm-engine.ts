/**
 * STORYWORLD LLM Engine
 * 
 * Uses RunAnywhere Web SDK (@runanywhere/web-llamacpp) for on-device LLM inference
 * with Qwen2.5-0.5B-Instruct model via llama.cpp WASM.
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

/**
 * Initialize the on-device LLM. Downloads ~350MB model on first use.
 */
export async function initLLM(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (llmState.status === 'ready') return true;

  initPromise = (async () => {
    try {
      updateState({ status: 'loading', progress: 0 });

      const { RunAnywhere, SDKEnvironment } = await import('@runanywhere/web');
      const { LlamaCPP, LlamaCppBridge, TextGeneration } = await import('@runanywhere/web-llamacpp');

      // Set WASM URL (copied by vite-plugin-static-copy)
      LlamaCppBridge.shared.wasmUrl = new URL('/assets/racommons-llamacpp.js', window.location.origin).href;

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }
      if (!LlamaCPP.isRegistered) {
        await LlamaCPP.register();
      }

      // Ensure WASM is loaded
      await LlamaCppBridge.shared.ensureLoaded('cpu');
      console.log('[STORYWORLD LLM] llama.cpp WASM loaded');

      // Download model with progress
      updateState({ status: 'downloading', progress: 0 });
      console.log('[STORYWORLD LLM] Downloading Qwen2.5-0.5B (~350MB)...');

      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`Model download failed: ${response.status}`);

      const contentLength = Number(response.headers.get('content-length') || 0);

      // Stream directly into WASM FS if possible, else buffer
      if (contentLength > 0) {
        // Buffer approach with progress tracking
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          updateState({ progress: Math.round((received / contentLength) * 100) });
        }

        const modelData = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          modelData.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`[STORYWORLD LLM] Downloaded: ${(received / 1e6).toFixed(1)}MB`);

        // Write to WASM virtual filesystem
        LlamaCppBridge.shared.writeFile(MODEL_FS_PATH, modelData);
      } else {
        // Stream directly to FS
        await LlamaCppBridge.shared.writeFileStream(MODEL_FS_PATH, response.body!);
      }

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
    // Try streaming
    const streamResult = await TextGeneration.generateStream(prompt, {
      maxTokens,
      temperature,
    });

    let fullText = '';
    for await (const chunk of streamResult.tokens) {
      const token = typeof chunk === 'string' ? chunk : (chunk as any).text || '';
      if (token) {
        fullText += token;
        onToken?.(token);
      }
    }

    // Clean up any trailing ChatML tokens
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
  // Remove any trailing ChatML tokens
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
