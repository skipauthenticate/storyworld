import { useState, useEffect, useCallback, useRef } from 'react';
import { initTTS, speakSentence, stopSpeaking, getTTSState, type TTSEngine } from '@/lib/tts-engine';
import { Sentence } from '@/data/sampleBooks';

interface UseNarrationOptions {
  sentences: Sentence[];
  speed: number;
  readingMode: 'classic' | 'narrated' | 'immersive';
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
}

export function useNarration({ sentences, speed: initialSpeed, readingMode }: UseNarrationOptions): UseNarrationReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>('none');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const playingRef = useRef(false);
  const indexRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    indexRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  // Initialize TTS
  useEffect(() => {
    setTtsLoading(true);
    initTTS().then((engine) => {
      setTtsEngine(engine);
      setTtsLoading(false);
    });
  }, []);

  // Speak current sentence and advance
  const speakCurrent = useCallback(async (idx: number) => {
    if (idx >= sentences.length || !playingRef.current) return;

    const sentence = sentences[idx];
    await speakSentence(sentence.text, {
      speed,
      onEnd: () => {
        if (!playingRef.current) return;
        const nextIdx = idx + 1;
        if (nextIdx < sentences.length) {
          setActiveSentenceIndex(nextIdx);
          indexRef.current = nextIdx;
          // Small pause between sentences
          setTimeout(() => {
            if (playingRef.current) {
              speakCurrent(nextIdx);
            }
          }, 200);
        } else {
          setIsPlaying(false);
          playingRef.current = false;
        }
      },
    });
  }, [sentences, speed]);

  const togglePlay = useCallback(() => {
    if (readingMode === 'classic') return;

    if (isPlaying) {
      setIsPlaying(false);
      playingRef.current = false;
      stopSpeaking();
    } else {
      setIsPlaying(true);
      playingRef.current = true;
      speakCurrent(indexRef.current);
    }
  }, [isPlaying, readingMode, speakCurrent]);

  const goToNext = useCallback(() => {
    stopSpeaking();
    const next = Math.min(sentences.length - 1, activeSentenceIndex + 1);
    setActiveSentenceIndex(next);
    indexRef.current = next;
    if (playingRef.current) {
      speakCurrent(next);
    }
  }, [activeSentenceIndex, sentences.length, speakCurrent]);

  const goToPrevious = useCallback(() => {
    stopSpeaking();
    const prev = Math.max(0, activeSentenceIndex - 1);
    setActiveSentenceIndex(prev);
    indexRef.current = prev;
    if (playingRef.current) {
      speakCurrent(prev);
    }
  }, [activeSentenceIndex, speakCurrent]);

  const goToSentence = useCallback((index: number) => {
    stopSpeaking();
    setActiveSentenceIndex(index);
    indexRef.current = index;
    if (playingRef.current) {
      speakCurrent(index);
    }
  }, [speakCurrent]);

  // Stop on unmount or mode change to classic
  useEffect(() => {
    if (readingMode === 'classic' && isPlaying) {
      setIsPlaying(false);
      playingRef.current = false;
      stopSpeaking();
    }
  }, [readingMode, isPlaying]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      playingRef.current = false;
    };
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
  };
}
