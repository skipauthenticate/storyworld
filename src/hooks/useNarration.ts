import { useState, useEffect, useCallback, useRef } from 'react';
import { initTTS, speakSentence, stopSpeaking, setActiveVoice, type TTSEngine, type VoiceId } from '@/lib/tts-engine';
import { Sentence } from '@/data/sampleBooks';

interface UseNarrationOptions {
  sentences: Sentence[];
  speed: number;
  voiceEnabled: boolean;
  voiceId?: VoiceId;
  onChapterEnd?: () => void;
}

interface UseNarrationReturn {
  isPlaying: boolean;
  activeSentenceIndex: number;
  ttsEngine: TTSEngine;
  ttsLoading: boolean;
  togglePlay: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToSentence: (index: number) => void;
  setSpeed: (speed: number) => void;
  setVoice: (id: VoiceId) => Promise<void>;
  reset: () => void;
}

function estimateReadingMs(text: string, speed: number): number {
  const words = text.split(/\s+/).length;
  const wpm = 250 * speed;
  return Math.max(800, (words / wpm) * 60000);
}

export function useNarration({ sentences, speed: initialSpeed, voiceEnabled, voiceId = 'piper-en-lessac', onChapterEnd }: UseNarrationOptions): UseNarrationReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>('none');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speed, setSpeedState] = useState(initialSpeed);
  const speedRef = useRef(initialSpeed);

  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const sentencesRef = useRef(sentences);
  const voiceEnabledRef = useRef(voiceEnabled);
  const ttsEngineRef = useRef(ttsEngine);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChapterEndRef = useRef(onChapterEnd);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { indexRef.current = activeSentenceIndex; }, [activeSentenceIndex]);
  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { ttsEngineRef.current = ttsEngine; }, [ttsEngine]);
  useEffect(() => { onChapterEndRef.current = onChapterEnd; }, [onChapterEnd]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset when sentences array identity changes (chapter switch)
  const prevSentencesRef = useRef(sentences);
  useEffect(() => {
    if (sentences !== prevSentencesRef.current) {
      prevSentencesRef.current = sentences;
      try { stopSpeaking(); } catch (_) {}
      clearTimer();
      setIsPlaying(false);
      playingRef.current = false;
      setActiveSentenceIndex(0);
      indexRef.current = 0;
    }
  }, [sentences, clearTimer]);

  // Initialize TTS with the selected voice
  useEffect(() => {
    setTtsLoading(true);
    initTTS(voiceId)
      .then((engine) => setTtsEngine(engine))
      .catch((err) => {
        console.warn('[Narration] TTS init failed:', err);
        setTtsEngine('none');
      })
      .finally(() => setTtsLoading(false));
  }, [voiceId]);

  const speakCurrent = useCallback(async (idx: number) => {
    if (idx >= sentencesRef.current.length || !playingRef.current) {
      if (idx >= sentencesRef.current.length) {
        setIsPlaying(false);
        playingRef.current = false;
        onChapterEndRef.current?.();
      }
      return;
    }

    const sentence = sentencesRef.current[idx];

    const advance = () => {
      if (!playingRef.current) return;
      const nextIdx = idx + 1;
      if (nextIdx < sentencesRef.current.length) {
        setActiveSentenceIndex(nextIdx);
        indexRef.current = nextIdx;
        setTimeout(() => {
          if (playingRef.current) speakCurrent(nextIdx);
        }, 200);
      } else {
        setIsPlaying(false);
        playingRef.current = false;
        onChapterEndRef.current?.();
      }
    };

    const currentSpeed = speedRef.current;

    if (voiceEnabledRef.current && ttsEngineRef.current !== 'none') {
      try {
        await speakSentence(sentence.text, { speed: currentSpeed, onEnd: advance });
      } catch (err) {
        console.warn('[Narration] TTS error at index', idx, err);
        if (playingRef.current) {
          setTimeout(advance, 500);
        }
      }
    } else {
      const ms = estimateReadingMs(sentence.text, currentSpeed);
      timerRef.current = setTimeout(advance, ms);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      playingRef.current = false;
      try { stopSpeaking(); } catch (_) {}
      clearTimer();
    } else {
      setIsPlaying(true);
      playingRef.current = true;
      speakCurrent(indexRef.current);
    }
  }, [isPlaying, speakCurrent, clearTimer]);

  const goToNext = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    clearTimer();
    const next = Math.min(sentencesRef.current.length - 1, activeSentenceIndex + 1);
    setActiveSentenceIndex(next);
    indexRef.current = next;
    if (playingRef.current) speakCurrent(next);
  }, [activeSentenceIndex, speakCurrent, clearTimer]);

  const goToPrevious = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    clearTimer();
    const prev = Math.max(0, activeSentenceIndex - 1);
    setActiveSentenceIndex(prev);
    indexRef.current = prev;
    if (playingRef.current) speakCurrent(prev);
  }, [activeSentenceIndex, speakCurrent, clearTimer]);

  const goToSentence = useCallback((index: number) => {
    try { stopSpeaking(); } catch (_) {}
    clearTimer();
    setActiveSentenceIndex(index);
    indexRef.current = index;
    if (playingRef.current) speakCurrent(index);
  }, [speakCurrent, clearTimer]);

  const reset = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    clearTimer();
    setIsPlaying(false);
    playingRef.current = false;
    setActiveSentenceIndex(0);
    indexRef.current = 0;
  }, [clearTimer]);

  const setVoice = useCallback(async (id: VoiceId) => {
    // Stop any current speech
    try { stopSpeaking(); } catch (_) {}
    clearTimer();
    if (playingRef.current) {
      setIsPlaying(false);
      playingRef.current = false;
    }
    setTtsLoading(true);
    try {
      const engine = await setActiveVoice(id);
      setTtsEngine(engine);
    } catch (err) {
      console.warn('[Narration] Failed to switch voice:', err);
    } finally {
      setTtsLoading(false);
    }
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      try { stopSpeaking(); } catch (_) {}
      clearTimer();
      playingRef.current = false;
    };
  }, [clearTimer]);

  return {
    isPlaying,
    activeSentenceIndex,
    ttsEngine,
    ttsLoading,
    togglePlay,
    goToNext,
    goToPrevious,
    goToSentence,
    setSpeed: (s: number) => { speedRef.current = s; setSpeedState(s); },
    setVoice,
    reset,
  };
}
