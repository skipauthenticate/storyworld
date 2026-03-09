import { useState, useEffect, useCallback } from "react";
import { Settings, Trash2, HardDrive, Brain, Volume2, BookOpen, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "./ThemeToggle";

// IndexedDB database names used by the app
const IDB_DATABASES = {
  models: { name: "storyworld-models", label: "LLM Model", icon: Brain, description: "Qwen2.5-0.5B (~350MB)" },
  voices: { name: "storyworld-voices", label: "TTS Voices", icon: Volume2, description: "Piper voice models (~64MB each)" },
  enrichment: { name: "storyworld-enrichment", label: "Enrichment Data", icon: BookOpen, description: "Chapter annotations & analysis" },
} as const;

// localStorage keys used by the app
const LS_KEYS = [
  "storyworld-library",
  "storyworld-font-size",
  "storyworld-reading-mode",
  "storyworld-reading-progress",
  "storyworld-voice-id",
  "storyworld-theme",
];

interface StorageEstimate {
  models: number | null;
  voices: number | null;
  enrichment: number | null;
  localStorage: number | null;
  total: number | null;
}

async function estimateIDBSize(dbName: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          db.close();
          resolve(0);
          return;
        }
        const tx = db.transaction(storeNames, "readonly");
        let totalSize = 0;
        let storesProcessed = 0;

        for (const storeName of storeNames) {
          const store = tx.objectStore(storeName);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const val = cursor.value;
              if (val instanceof ArrayBuffer) {
                totalSize += val.byteLength;
              } else if (val instanceof Uint8Array) {
                totalSize += val.byteLength;
              } else if (val?.data instanceof ArrayBuffer) {
                totalSize += val.data.byteLength;
              } else if (val?.data instanceof Uint8Array) {
                totalSize += val.data.byteLength;
              } else {
                // Estimate JSON size
                try { totalSize += JSON.stringify(val).length * 2; } catch { totalSize += 1024; }
              }
              cursor.continue();
            } else {
              storesProcessed++;
              if (storesProcessed === storeNames.length) {
                db.close();
                resolve(totalSize);
              }
            }
          };
          cursorReq.onerror = () => {
            storesProcessed++;
            if (storesProcessed === storeNames.length) {
              db.close();
              resolve(totalSize);
            }
          };
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function estimateLocalStorageSize(): number {
  let total = 0;
  for (const key of LS_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val) total += (key.length + val.length) * 2; // UTF-16
    } catch {}
  }
  return total;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "unknown";
  if (bytes === 0) return "empty";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function deleteIDB(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      // DB is open elsewhere — try closing and retrying
      console.warn(`[Settings] Database ${dbName} blocked on delete, resolving anyway`);
      resolve();
    };
  });
}

function clearLocalStorage() {
  for (const key of LS_KEYS) {
    try { localStorage.removeItem(key); } catch {}
  }
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [storage, setStorage] = useState<StorageEstimate>({
    models: null, voices: null, enrichment: null, localStorage: null, total: null,
  });
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    key: string;
    label: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const refreshEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const [models, voices, enrichment] = await Promise.all([
        estimateIDBSize(IDB_DATABASES.models.name),
        estimateIDBSize(IDB_DATABASES.voices.name),
        estimateIDBSize(IDB_DATABASES.enrichment.name),
      ]);
      const ls = estimateLocalStorageSize();
      const total = [models, voices, enrichment, ls].reduce<number>((sum, v) => sum + (v ?? 0), 0);
      setStorage({ models, voices, enrichment, localStorage: ls, total });
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refreshEstimates();
  }, [open, refreshEstimates]);

  const handleClear = useCallback(async (key: string, action: () => Promise<void>) => {
    setClearing(key);
    try {
      await action();
      await refreshEstimates();
    } catch (err) {
      console.error(`[Settings] Failed to clear ${key}:`, err);
    } finally {
      setClearing(null);
      setConfirmAction(null);
    }
  }, [refreshEstimates]);

  const storageItems = [
    {
      key: "models",
      ...IDB_DATABASES.models,
      size: storage.models,
      onClear: () => setConfirmAction({
        key: "models",
        label: "Clear LLM Model",
        description: "This will delete the cached AI model (~350MB). It will be re-downloaded next time you use enrichment or AI chat.",
        action: async () => { await deleteIDB(IDB_DATABASES.models.name); },
      }),
    },
    {
      key: "voices",
      ...IDB_DATABASES.voices,
      size: storage.voices,
      onClear: () => setConfirmAction({
        key: "voices",
        label: "Clear TTS Voices",
        description: "This will delete all cached text-to-speech voice models. They will be re-downloaded when you next use narration.",
        action: async () => { await deleteIDB(IDB_DATABASES.voices.name); },
      }),
    },
    {
      key: "enrichment",
      ...IDB_DATABASES.enrichment,
      size: storage.enrichment,
      onClear: () => setConfirmAction({
        key: "enrichment",
        label: "Clear Enrichment Data",
        description: "This will delete all chapter annotations and analysis progress. You can re-run enrichment on any book.",
        action: async () => { await deleteIDB(IDB_DATABASES.enrichment.name); },
      }),
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </DialogTitle>
            <DialogDescription>
              Manage storage, preferences, and cached data.
            </DialogDescription>
          </DialogHeader>

          {/* Theme */}
          <div className="flex items-center justify-between py-2 px-1">
            <div>
              <p className="text-[13px] font-medium">Theme</p>
              <p className="text-[11px] text-muted-foreground">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>

          <div className="h-px bg-border" />

          {/* Storage */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="w-3 h-3" />
                Storage
              </p>
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatBytes(storage.total)} total
                </span>
              )}
            </div>

            <div className="space-y-1.5 mt-2">
              {storageItems.map((item) => {
                const Icon = item.icon;
                const isEmpty = item.size === 0;
                const isClearing = clearing === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg border border-border bg-muted/20"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatBytes(item.size)}
                      </span>
                      <button
                        onClick={item.onClear}
                        disabled={isEmpty || isClearing}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={`Clear ${item.label.toLowerCase()}`}
                      >
                        {isClearing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Clear all */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[13px] font-medium text-destructive">Clear All Data</p>
              <p className="text-[11px] text-muted-foreground">Remove all models, voices, library, and preferences</p>
            </div>
            <button
              onClick={() => setConfirmAction({
                key: "all",
                label: "Clear All Data",
                description: "This will delete everything: cached models, voices, your imported books, enrichment data, and all preferences. The page will reload afterward.",
                action: async () => {
                  await Promise.allSettled([
                    deleteIDB(IDB_DATABASES.models.name),
                    deleteIDB(IDB_DATABASES.voices.name),
                    deleteIDB(IDB_DATABASES.enrichment.name),
                  ]);
                  clearLocalStorage();
                  window.location.reload();
                },
              })}
              disabled={!!clearing}
              className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-[11px] hover:bg-destructive/10 transition-colors disabled:opacity-30"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Clear All
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) handleClear(confirmAction.key, confirmAction.action);
              }}
              disabled={!!clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Clearing...
                </span>
              ) : (
                "Clear"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
