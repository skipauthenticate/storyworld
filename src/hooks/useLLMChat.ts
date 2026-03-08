import { useState, useCallback, useRef, useEffect } from "react";
import {
  initLLM,
  chatGenerate,
  cancelGeneration,
  onLLMStateChange,
  getLLMState,
  type ChatMessage,
  type LLMEngineStatus,
} from "@/lib/llm-engine";

export function useLLMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engineStatus, setEngineStatus] = useState<LLMEngineStatus>(getLLMState().status);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    return onLLMStateChange((state) => {
      setEngineStatus(state.status);
      setDownloadProgress(state.progress);
    });
  }, []);

  const initEngine = useCallback(async () => {
    setChatError(null);
    try {
      return await initLLM();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize AI engine';
      console.error('[LLM Chat] Init error:', err);
      setChatError(msg);
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (
    userText: string,
    systemPrompt?: string
  ) => {
    if (isGenerating || !userText.trim()) return;
    setChatError(null);

    const userMsg: ChatMessage = { role: 'user', content: userText.trim() };
    const allMessages: ChatMessage[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages,
      userMsg,
    ];

    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    abortRef.current = false;

    try {
      let assistantText = '';
      await chatGenerate(allMessages, {
        maxTokens: 512,
        temperature: 0.7,
        onToken: (token) => {
          if (abortRef.current) return;
          assistantText += token;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantText } : m
              );
            }
            return [...prev, { role: 'assistant', content: assistantText }];
          });
        },
        onDone: (fullText) => {
          if (!abortRef.current) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: fullText } : m
                );
              }
              return [...prev, { role: 'assistant', content: fullText }];
            });
          }
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[LLM Chat] Error:', err);
      setChatError(msg);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error generating a response. Please try again.' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, isGenerating]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    try { cancelGeneration(); } catch (_) { /* ignore */ }
    setIsGenerating(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setChatError(null);
  }, []);

  return {
    messages,
    isGenerating,
    engineStatus,
    downloadProgress,
    chatError,
    sendMessage,
    cancel,
    clearMessages,
    initEngine,
  };
}
