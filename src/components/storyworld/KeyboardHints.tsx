import { useState } from "react";
import { X, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISSED_KEY = "storyworld-hints-dismissed";

const hints = [
  { keys: ["Space"], action: "Play / Pause narration" },
  { keys: ["←"], action: "Previous sentence" },
  { keys: ["→"], action: "Next sentence" },
];

export function KeyboardHints() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "true"; } catch { return false; }
  });

  if (dismissed) return null;

  return (
    <>
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 left-4 z-40 p-2 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors shadow-lg"
        title="Keyboard shortcuts"
        aria-label="Show keyboard shortcuts"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-14 left-4 z-50 w-64 bg-card border border-border rounded-lg shadow-xl p-4"
            role="dialog"
            aria-label="Keyboard shortcuts"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Shortcuts
              </p>
              <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close shortcuts">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {hints.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{h.action}</span>
                  <div className="flex gap-1">
                    {h.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setDismissed(true);
                setVisible(false);
                try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
              }}
              className="mt-3 text-[10px] text-muted-foreground hover:text-foreground font-mono"
            >
              Don't show again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
