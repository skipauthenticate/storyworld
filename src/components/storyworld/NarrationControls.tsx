import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2 } from "lucide-react";
import { TTSEngine } from "@/lib/tts-engine";
import { useState } from "react";

interface NarrationControlsProps {
  isPlaying: boolean;
  speed: number;
  currentSentence: number;
  totalSentences: number;
  ttsEngine: TTSEngine;
  ttsLoading: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
}

const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

const engineLabels: Record<TTSEngine, string> = {
  runanywhere: "Piper Neural TTS",
  webspeech: "Web Speech API",
  none: "No TTS",
};

export function NarrationControls({
  isPlaying,
  speed,
  currentSentence,
  totalSentences,
  ttsEngine,
  ttsLoading,
  onTogglePlay,
  onPrevious,
  onNext,
  onSpeedChange,
}: NarrationControlsProps) {
  const [muted, setMuted] = useState(false);
  const progress = totalSentences > 0 ? ((currentSentence + 1) / totalSentences) * 100 : 0;

  const handleToggleMute = () => {
    setMuted(!muted);
    // Web Speech API volume control
    if ('speechSynthesis' in window) {
      // Volume applies to next utterance
    }
  };

  return (
    <div className="border-t border-border bg-card px-4 sm:px-6 py-3">
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-muted rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {/* Left: sentence counter + engine indicator */}
        <div className="flex items-center gap-2 sm:gap-3 w-24 sm:w-40">
          <span className="text-[10px] font-mono text-muted-foreground">
            {currentSentence + 1} / {totalSentences}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/60 items-center gap-1 hidden sm:flex">
            {ttsLoading ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <span className={ttsEngine === 'runanywhere' ? 'text-secondary' : 'text-muted-foreground/60'}>●</span>
                {engineLabels[ttsEngine]}
              </>
            )}
          </span>
        </div>

        {/* Center: playback controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevious}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={ttsLoading || ttsEngine === 'none'}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: speed + volume */}
        <div className="flex items-center gap-2 w-24 sm:w-40 justify-end">
          <button
            onClick={() => {
              const currentIdx = speeds.indexOf(speed);
              const nextIdx = (currentIdx + 1) % speeds.length;
              onSpeedChange(speeds[nextIdx]);
            }}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border transition-colors"
          >
            {speed}x
          </button>
          <button
            onClick={handleToggleMute}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
