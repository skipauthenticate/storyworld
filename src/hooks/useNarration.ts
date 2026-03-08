import { useState, useEffect, useCallback, useRef } from 'react';
import { initTTS, speakSentence, stopSpeaking, getTTSState, type TTSEngine } from '@/lib/tts-engine';
import { Sentence } from '@/data/sampleBooks';

interface UseNarrationOptions {
  sentences: Sentence[];
  speed: number;
  voiceEnabled: boolean;
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
  reset: () => void;
}

export function useNarration({ sentences, speed: initialSpeed, voiceEnabled }: UseNarrationOptions): UseNarrationReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>('none');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const sentencesRef = useRef(sentences);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { indexRef.current = activeSentenceIndex; }, [activeSentenceIndex]);
  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);

  // Reset when sentences array identity changes (chapter switch)
  const prevSentencesRef = useRef(sentences);
  useEffect(() => {
    if (sentences !== prevSentencesRef.current) {
      prevSentencesRef.current = sentences;
      try { stopSpeaking(); } catch (_) {}
      setIsPlaying(false);
      playingRef.current = false;
      setActiveSentenceIndex(0);
      indexRef.current = 0;
    }
  }, [sentences]);

  // Initialize TTS — wrapped in try/catch
  useEffect(() => {
    setTtsLoading(true);
    initTTS()
      .then((engine) => {
        setTtsEngine(engine);
      })
      .catch((err) => {
        console.warn('[Narration] TTS init failed, continuing without voice:', err);
        setTtsEngine('none');
      })
      .finally(() => {
        setTtsLoading(false);
      });
  }, []);

  const speakCurrent = useCallback(async (idx: number) => {
    if (idx >= sentencesRef.current.length || !playingRef.current) return;
    const sentence = sentencesRef.current[idx];
    try {
      await speakSentence(sentence.text, {
        speed,
        onEnd: () => {
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
          }
        },
      });
    } catch (err) {
      console.warn('[Narration] speakCurrent failed at index', idx, err);
      // Advance to next sentence despite error so narration doesn't stall
      if (playingRef.current) {
        const nextIdx = idx + 1;
        if (nextIdx < sentencesRef.current.length) {
          setActiveSentenceIndex(nextIdx);
          indexRef.current = nextIdx;
          setTimeout(() => {
            if (playingRef.current) speakCurrent(nextIdx);
          }, 500);
        } else {
          setIsPlaying(false);
          playingRef.current = false;
        }
      }
    }
  }, [speed]);

  const voiceEnabledRef = useRef(voiceEnabled);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      playingRef.current = false;
      try { stopSpeaking(); } catch (_) {}
    } else {
      setIsPlaying(true);
      playingRef.current = true;
      speakCurrent(indexRef.current);
    }
  }, [isPlaying, speakCurrent]);

  const goToNext = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    const next = Math.min(sentencesRef.current.length - 1, activeSentenceIndex + 1);
    setActiveSentenceIndex(next);
    indexRef.current = next;
    if (playingRef.current) speakCurrent(next);
  }, [activeSentenceIndex, speakCurrent]);

  const goToPrevious = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    const prev = Math.max(0, activeSentenceIndex - 1);
    setActiveSentenceIndex(prev);
    indexRef.current = prev;
    if (playingRef.current) speakCurrent(prev);
  }, [activeSentenceIndex, speakCurrent]);

  const goToSentence = useCallback((index: number) => {
    try { stopSpeaking(); } catch (_) {}
    setActiveSentenceIndex(index);
    indexRef.current = index;
    if (playingRef.current) speakCurrent(index);
  }, [speakCurrent]);

  const reset = useCallback(() => {
    try { stopSpeaking(); } catch (_) {}
    setIsPlaying(false);
    playingRef.current = false;
    setActiveSentenceIndex(0);
    indexRef.current = 0;
  }, []);

  // Stop when voice is disabled
  useEffect(() => {
    if (!voiceEnabled && isPlaying) {
      setIsPlaying(false);
      playingRef.current = false;
      try { stopSpeaking(); } catch (_) {}
    }
  }, [voiceEnabled, isPlaying]);

  useEffect(() => {
    return () => { try { stopSpeaking(); } catch (_) {} playingRef.current = false; };
  }, []);

  return {
    isPlaying,
    activeSentenceIndex,
    ttsEngine,
    ttsLoading,
    togglePlay,
    goToNext,
    goToPrevious,
    goToSentence,
    setSpeed: (s: number) => setSpeed(s),
    reset,
  };
}
