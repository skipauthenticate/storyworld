import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Brain } from "lucide-react";
import { TTSEngine } from "@/lib/tts-engine";
import { cn } from "@/lib/utils";

interface NarrationControlsProps {
  isPlaying: boolean;
  speed: number;
  currentSentence: number;
  totalSentences: number;
  ttsEngine: TTSEngine;
  ttsLoading: boolean;
  voiceEnabled: boolean;
  intelligenceEnabled: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleVoice: () => void;
  onToggleIntelligence: () => void;
}

const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

export function NarrationControls({
  isPlaying,
  speed,
  currentSentence,
  totalSentences,
  ttsEngine,
  ttsLoading,
  voiceEnabled,
  intelligenceEnabled,
  onTogglePlay,
  onPrevious,
  onNext,
  onSpeedChange,
  onToggleVoice,
  onToggleIntelligence,
}: NarrationControlsProps) {
  const progress = totalSentences > 0 ? ((currentSentence + 1) / totalSentences) * 100 : 0;

  return (
    <div className="border-t border-border bg-card px-4 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-muted rounded-full mb-3 overflow-hidden" role="progressbar" aria-valuenow={currentSentence + 1} aria-valuemax={totalSentences}>
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {/* Left: feature toggles */}
        <div className="flex items-center gap-1.5 w-24 sm:w-40">
          <button
            onClick={onToggleVoice}
            className={cn(
              "p-1.5 rounded-md transition-colors text-[10px] font-mono flex items-center gap-1",
              voiceEnabled
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle voice narration"
            aria-label={voiceEnabled ? "Disable voice narration" : "Enable voice narration"}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Voice</span>
          </button>
          <button
            onClick={onToggleIntelligence}
            className={cn(
              "p-1.5 rounded-md transition-colors text-[10px] font-mono flex items-center gap-1",
              intelligenceEnabled
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle intelligence panel"
            aria-label={intelligenceEnabled ? "Hide intelligence panel" : "Show intelligence panel"}
            aria-pressed={intelligenceEnabled}
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intel</span>
          </button>
        </div>

        {/* Center: playback controls */}
        <div className="flex items-center gap-3" role="group" aria-label="Playback controls">
          <button
            onClick={onPrevious}
            disabled={!voiceEnabled}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Previous sentence"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={!voiceEnabled || ttsLoading || ttsEngine === 'none'}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
            aria-label={isPlaying ? "Pause narration" : "Play narration"}
          >
            {ttsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>
          <button
            onClick={onNext}
            disabled={!voiceEnabled}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Next sentence"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: speed + sentence counter */}
        <div className="flex items-center gap-2 w-24 sm:w-40 justify-end">
          <span className="text-[10px] font-mono text-muted-foreground" aria-label={`Sentence ${currentSentence + 1} of ${totalSentences}`}>
            {currentSentence + 1}/{totalSentences}
          </span>
          <button
            onClick={() => {
              const currentIdx = speeds.indexOf(speed);
              const nextIdx = (currentIdx + 1) % speeds.length;
              onSpeedChange(speeds[nextIdx]);
            }}
            disabled={!voiceEnabled}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border transition-colors disabled:opacity-30"
            aria-label={`Playback speed ${speed}x. Click to change.`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
