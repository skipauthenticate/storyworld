import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Zap, Keyboard, ChevronRight } from "lucide-react";
import { TTSEngine, VoiceId, AVAILABLE_VOICES } from "@/lib/tts-engine";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NarrationControlsProps {
  isPlaying: boolean;
  speed: number;
  currentSentence: number;
  totalSentences: number;
  bookProgress: number;
  ttsEngine: TTSEngine;
  ttsLoading: boolean;
  voiceEnabled: boolean;
  intelligenceEnabled: boolean;
  chapterLabel: string;
  voiceId: VoiceId;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleVoice: () => void;
  onToggleIntelligence: () => void;
  onVoiceChange: (id: VoiceId) => void;
}

const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

const shortcuts = [
  { key: "Space", action: "Play / Pause" },
  { key: "←", action: "Previous sentence" },
  { key: "→", action: "Next sentence" },
];

function VoiceLabel({ voiceId, ttsEngine }: { voiceId: VoiceId; ttsEngine: TTSEngine }) {
  const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
  if (!voice) return <span>Voice</span>;
  if (voiceId === 'webspeech') return <span className="hidden sm:inline">System</span>;
  if (ttsEngine === 'runanywhere') {
    return <span className="hidden sm:inline">AI · {voice.accent}</span>;
  }
  return <span className="hidden sm:inline">AI Voice</span>;
}

export function NarrationControls({
  isPlaying,
  speed,
  currentSentence,
  totalSentences,
  bookProgress,
  ttsEngine,
  ttsLoading,
  voiceEnabled,
  intelligenceEnabled,
  chapterLabel,
  voiceId,
  onTogglePlay,
  onPrevious,
  onNext,
  onSpeedChange,
  onToggleVoice,
  onToggleIntelligence,
  onVoiceChange,
}: NarrationControlsProps) {
  const chapterProgress = totalSentences > 0 ? ((currentSentence + 1) / totalSentences) * 100 : 0;

  return (
    <div className="border-t border-border bg-card px-4 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      {/* Progress bars */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={currentSentence + 1} aria-valuemax={totalSentences} aria-label="Chapter progress">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${chapterProgress}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
          {bookProgress}%
        </span>
      </div>

      <div className="flex items-center justify-between">
        {/* Left: feature toggles */}
        <div className="flex items-center gap-1.5 w-24 sm:w-44">
          {/* Voice toggle + switcher */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "p-1.5 rounded-md transition-colors text-[10px] font-mono flex items-center gap-1",
                  voiceEnabled
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Voice narration settings"
                aria-label="Open voice settings"
                aria-pressed={voiceEnabled}
              >
                {ttsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : voiceEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <VoiceLabel voiceId={voiceId} ttsEngine={ttsEngine} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-56 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  Voice
                </p>
                <button
                  onClick={onToggleVoice}
                  className={cn(
                    "text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors border",
                    voiceEnabled
                      ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {voiceEnabled ? "On" : "Off"}
                </button>
              </div>
              <div className="space-y-0.5">
                {AVAILABLE_VOICES.map((voice) => {
                  const isActive = voiceId === voice.id;
                  const isLoading = ttsLoading && isActive;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => {
                        onVoiceChange(voice.id);
                        if (!voiceEnabled) onToggleVoice();
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors group",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {/* Active dot / loading spinner */}
                      <span className="w-3.5 flex items-center justify-center flex-shrink-0">
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-border block" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium block leading-tight">
                          {voice.label}{voice.accent ? ` · ${voice.accent}` : ''}
                        </span>
                        {voice.sizeHint && !isActive && (
                          <span className="text-[9px] text-muted-foreground/60">{voice.sizeHint} on first use</span>
                        )}
                      </span>
                      {!isActive && (
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

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
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intel</span>
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors hidden sm:flex"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-52 p-3">
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
                Shortcuts
              </p>
              <div className="space-y-1.5">
                {shortcuts.map((h) => (
                  <div key={h.key} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{h.action}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono text-foreground">
                      {h.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Center: playback controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3" role="group" aria-label="Playback controls">
            <button
              onClick={onPrevious}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePlay}
              disabled={ttsLoading}
              className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
              aria-label={isPlaying ? "Pause" : "Play"}
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
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              aria-label="Next sentence"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">{chapterLabel}</span>
        </div>

        {/* Right: speed + sentence counter */}
        <div className="flex items-center gap-2 w-24 sm:w-44 justify-end">
          <span className="text-[10px] font-mono text-muted-foreground" aria-label={`Sentence ${currentSentence + 1} of ${totalSentences}`}>
            {currentSentence + 1}/{totalSentences}
          </span>
          <button
            onClick={() => {
              const currentIdx = speeds.indexOf(speed);
              const nextIdx = (currentIdx + 1) % speeds.length;
              onSpeedChange(speeds[nextIdx]);
            }}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border transition-colors"
            aria-label={`Playback speed ${speed}x. Click to change.`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
