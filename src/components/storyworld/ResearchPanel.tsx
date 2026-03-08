import { useEffect, useState, useRef } from "react";
import { useAutoResearch, Experiment } from "@/hooks/useAutoResearch";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DOMAIN_LABELS: Record<string, string> = {
  annotations: "Annotation",
  characters: "Character",
  themes: "Theme",
  prompts: "Prompt",
  content: "Content",
  ux_copy: "UX",
  meta: "Meta",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  keep: { icon: CheckCircle2, color: "text-primary" },
  discard: { icon: XCircle, color: "text-muted-foreground" },
  crash: { icon: AlertTriangle, color: "text-destructive" },
  pending: { icon: Loader2, color: "text-muted-foreground" },
};

export function ResearchPanel() {
  const {
    experiments,
    isRunning,
    error,
    fetchExperiments,
    runExperiment,
  } = useAutoResearch();

  const [expanded, setExpanded] = useState<string | null>(null);
  const hasAutoRun = useRef(false);

  // Fetch on mount + auto-run one experiment if none exist
  useEffect(() => {
    fetchExperiments().then(() => {
      if (!hasAutoRun.current) {
        hasAutoRun.current = true;
      }
    });
  }, [fetchExperiments]);

  // Auto-run when panel opens and no experiments yet
  useEffect(() => {
    if (hasAutoRun.current && experiments.length === 0 && !isRunning) {
      runExperiment();
    }
  }, [experiments.length, isRunning, runExperiment]);

  const keepCount = experiments.filter((e) => e.status === "keep").length;
  const totalCount = experiments.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full"
    >
      {/* Subtle header with live status */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground"
            >
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Improving...</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground"
            >
              <Sparkles className="w-3 h-3 text-primary/50" />
              <span>{keepCount} improvements</span>
              {totalCount > keepCount && (
                <span className="text-muted-foreground/40">· {totalCount} tried</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle inline trigger — just a text link */}
        {!isRunning && totalCount > 0 && (
          <button
            onClick={() => runExperiment()}
            className="ml-auto text-[10px] font-mono text-primary/60 hover:text-primary transition-colors"
          >
            improve more
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-1.5 text-[10px] text-destructive/80 bg-destructive/5 border-b border-border">
          {error}
        </div>
      )}

      {/* Experiment feed */}
      <div className="flex-1 overflow-y-auto">
        {experiments.length === 0 && isRunning && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <Loader2 className="w-6 h-6 text-primary/30 animate-spin mb-3" />
            <p className="text-[11px] text-muted-foreground">
              Analyzing content for improvements...
            </p>
          </div>
        )}

        {experiments.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <Sparkles className="w-6 h-6 text-muted-foreground/20 mb-3" />
            <p className="text-[11px] text-muted-foreground/60">
              Storyworld continuously refines its literary analysis
            </p>
          </div>
        )}

        <div className="divide-y divide-border/50">
          {experiments.map((exp) => (
            <ExperimentRow
              key={exp.id}
              experiment={exp}
              isExpanded={expanded === exp.id}
              onToggle={() => setExpanded(expanded === exp.id ? null : exp.id)}
            />
          ))}
        </div>
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
  const score = Number(exp.composite_score) || 0;

  return (
    <div
      className="px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", config.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] leading-snug text-foreground/85 line-clamp-2">
            {exp.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {DOMAIN_LABELS[exp.domain] || exp.domain}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/30">
              {score.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2.5 ml-5.5 space-y-2 overflow-hidden"
          >
            {exp.before_value && (
              <div className="p-2 rounded-md bg-muted/30 border border-border/50">
                <p className="text-[9px] font-mono uppercase text-muted-foreground/40 mb-1">Before</p>
                <p className="text-[11px] leading-relaxed text-foreground/60">{exp.before_value}</p>
              </div>
            )}
            {exp.after_value && (
              <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
                <p className="text-[9px] font-mono uppercase text-primary/40 mb-1">After</p>
                <p className="text-[11px] leading-relaxed text-foreground/70">{exp.after_value}</p>
              </div>
            )}

            <div className="flex gap-3 text-[9px] font-mono text-muted-foreground/30">
              <span>{exp.target_id}</span>
              <span>{new Date(exp.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
