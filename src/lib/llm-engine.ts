/**
 * STORYWORLD LLM Engine
 * 
 * Uses RunAnywhere Web SDK (llama.cpp WASM) for on-device LLM inference
 * with Qwen2.5-0.5B-Instruct model.
 */

export type LLMEngineStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface LLMState {
  status: LLMEngineStatus;
  progress: number; // 0-100 download progress
  error: string | null;
}

let llmState: LLMState = {
  status: 'idle',
  progress: 0,
  error: null,
};

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
const MODEL_LOCAL_PATH = '/models/qwen2.5-0.5b-instruct-q4_0.gguf';

/**
 * Initialize the on-device LLM. Downloads model on first use (~350MB).
 */
export async function initLLM(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (llmState.status === 'ready') return true;

  initPromise = (async () => {
    try {
      updateState({ status: 'downloading', progress: 0 });

      const { RunAnywhere, SDKEnvironment, TextGeneration } = await import('@runanywhere/web');

      if (!RunAnywhere.isInitialized) {
        await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: false });
      }

      // Download model with progress tracking
      console.log('[STORYWORLD LLM] Downloading Qwen2.5-0.5B model...');
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`Failed to download model: ${response.status}`);

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

      // Combine chunks
      const modelData = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        modelData.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`[STORYWORLD LLM] Model downloaded: ${(received / 1e6).toFixed(1)}MB`);
      updateState({ status: 'loading', progress: 100 });

      // Write model to WASM virtual FS and load
      // TextGeneration.loadModel accepts a URL or path - we'll use a blob URL
      const blob = new Blob([modelData], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      await TextGeneration.loadModel(blobUrl, MODEL_ID);
      URL.revokeObjectURL(blobUrl);

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
 * Generate a chat response using the on-device LLM.
 * Streams tokens via onToken callback.
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

  const { TextGeneration } = await import('@runanywhere/web');

  // Format messages into a prompt (ChatML format for Qwen)
  const prompt = formatChatMLPrompt(messages);

  try {
    // Try streaming first
    const { stream } = await TextGeneration.generateStream(prompt, {
      maxTokens,
      temperature,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const token = chunk.text || chunk.token || '';
      if (token) {
        fullText += token;
        onToken?.(token);
      }
    }

    onDone?.(fullText);
    return fullText;
  } catch (streamErr) {
    console.warn('[STORYWORLD LLM] Streaming failed, using non-streaming:', streamErr);
    // Fallback to non-streaming
    const result = await TextGeneration.generate(prompt, {
      maxTokens,
      temperature,
    });
    const text = result.text || '';
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
