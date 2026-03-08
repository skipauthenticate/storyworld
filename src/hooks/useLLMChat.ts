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
  const abortRef = useRef(false);

  useEffect(() => {
    return onLLMStateChange((state) => {
      setEngineStatus(state.status);
      setDownloadProgress(state.progress);
    });
  }, []);

  const initEngine = useCallback(async () => {
    return initLLM();
  }, []);

  const sendMessage = useCallback(async (
    userText: string,
    systemPrompt?: string
  ) => {
    if (isGenerating || !userText.trim()) return;

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
      console.error('[LLM Chat] Error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error generating a response.' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, isGenerating]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    cancelGeneration();
    setIsGenerating(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isGenerating,
    engineStatus,
    downloadProgress,
    sendMessage,
    cancel,
    clearMessages,
    initEngine,
  };
}
