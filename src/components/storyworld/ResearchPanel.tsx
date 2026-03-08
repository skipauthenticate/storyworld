import { useEffect, useState } from "react";
import { useAutoResearch, Experiment } from "@/hooks/useAutoResearch";
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Repeat,
} from "lucide-react";
import { motion } from "framer-motion";

const DOMAIN_LABELS: Record<string, string> = {
  annotations: "Annotations",
  characters: "Characters",
  themes: "Themes",
  prompts: "Prompts",
  content: "Content",
  ux_copy: "UX Copy",
  meta: "Meta",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  keep: { icon: CheckCircle2, color: "text-emerald-500", label: "Keep" },
  discard: { icon: XCircle, color: "text-muted-foreground", label: "Discard" },
  crash: { icon: AlertTriangle, color: "text-destructive", label: "Crash" },
  pending: { icon: Loader2, color: "text-primary", label: "Pending" },
};

export function ResearchPanel() {
  const {
    experiments,
    isRunning,
    error,
    fetchExperiments,
    runExperiment,
    runLoop,
  } = useAutoResearch();

  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const keepCount = experiments.filter((e) => e.status === "keep").length;
  const discardCount = experiments.filter((e) => e.status === "discard").length;
  const avgScore =
    experiments.length > 0
      ? (experiments.reduce((sum, e) => sum + (Number(e.composite_score) || 0), 0) / experiments.length).toFixed(1)
      : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full"
    >
      {/* Stats bar */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
        <span className="text-emerald-500">{keepCount} kept</span>
        <span>{discardCount} discarded</span>
        <span>avg: {avgScore}</span>
        <span className="ml-auto text-[9px]">{experiments.length} total</span>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => runExperiment()}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono transition-colors",
            isRunning
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isRunning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {isRunning ? "Running..." : "Run Experiment"}
        </button>
        <button
          onClick={() => runLoop(3)}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono border transition-colors",
            isRunning
              ? "border-border text-muted-foreground cursor-not-allowed"
              : "border-border text-foreground hover:bg-muted"
          )}
        >
          <Repeat className="w-3 h-3" />
          Run ×3
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 text-[11px] text-destructive bg-destructive/10 border-b border-destructive/20">
          {error}
        </div>
      )}

      {/* Experiment log */}
      <div className="flex-1 overflow-y-auto">
        {experiments.length === 0 && !isRunning ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <FlaskConical className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No experiments yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Run an experiment to start the self-improvement loop. The AI will propose and evaluate improvements to Storyworld's literary content.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {experiments.map((exp) => (
              <ExperimentRow
                key={exp.id}
                experiment={exp}
                isExpanded={expanded === exp.id}
                onToggle={() => setExpanded(expanded === exp.id ? null : exp.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ExperimentRow({
  experiment: exp,
  isExpanded,
  onToggle,
}: {
  experiment: Experiment;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
      <div className="flex items-start gap-2">
        <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {DOMAIN_LABELS[exp.domain] || exp.domain}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {Number(exp.composite_score)?.toFixed(1) || "—"}
            </span>
          </div>
          <p className="text-[12px] leading-snug text-foreground/90 truncate">
            {exp.description}
          </p>
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 ml-5 space-y-2"
        >
          {/* Scores */}
          <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
            <span>insight: {exp.score_insight}</span>
            <span>merit: {exp.score_merit}</span>
            <span>coherence: {exp.score_coherence}</span>
            <span>originality: {exp.score_originality}</span>
          </div>

          {/* Before/After */}
          {exp.before_value && (
            <div className="p-2 rounded bg-destructive/5 border border-destructive/10">
              <p className="text-[9px] font-mono uppercase text-destructive/60 mb-1">Before</p>
              <p className="text-[11px] leading-relaxed text-foreground/70">{exp.before_value}</p>
            </div>
          )}
          {exp.after_value && (
            <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[9px] font-mono uppercase text-emerald-600/60 mb-1">After</p>
              <p className="text-[11px] leading-relaxed text-foreground/70">{exp.after_value}</p>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground/40 font-mono">
            {exp.target_id} · {new Date(exp.created_at).toLocaleString()}
          </p>
        </motion.div>
      )}
    </div>
  );
}
