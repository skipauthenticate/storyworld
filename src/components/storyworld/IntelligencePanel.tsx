import { Sentence, Book } from "@/data/sampleBooks";
import { X, MessageSquare, Sparkles, User, Send, Loader2, Download, Brain, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useLLMChat } from "@/hooks/useLLMChat";

interface IntelligencePanelProps {
  selectedSentence: Sentence | null;
  book: Book;
  onClose: () => void;
  className?: string;
}

export function IntelligencePanel({
  selectedSentence,
  book,
  onClose,
  className,
}: IntelligencePanelProps) {
  const [chatExpanded, setChatExpanded] = useState(false);

  return (
    <aside className={cn("w-[340px] min-w-[340px] h-full flex flex-col border-l border-border bg-card overflow-hidden", className)} role="complementary" aria-label="Intelligence panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Intelligence
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close intelligence panel">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context content — scrollable, shrinks when chat is expanded */}
      <div className={cn("overflow-y-auto transition-all", chatExpanded ? "flex-shrink-0 max-h-[35%]" : "flex-1")}>
        <ContextContent selectedSentence={selectedSentence} book={book} />
      </div>

      {/* Persistent chat area */}
      <PersistentChat
        book={book}
        selectedSentence={selectedSentence}
        expanded={chatExpanded}
        onToggleExpand={() => setChatExpanded(v => !v)}
      />
    </aside>
  );
}

function ContextContent({ selectedSentence, book }: { selectedSentence: Sentence | null; book: Book }) {
  return (
    <div className="p-4 space-y-6">
      {/* Annotation section */}
      {selectedSentence ? (
        <div className="space-y-4">
          <div className="p-3 rounded bg-muted/50 border border-border">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
              Selected Passage
            </p>
            <p className="text-[14px] leading-relaxed italic text-foreground/90">
              "{selectedSentence.text}"
            </p>
            {selectedSentence.speaker && (
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                — {selectedSentence.speaker}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
              {selectedSentence.type}
            </span>
            {selectedSentence.emotion && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                {selectedSentence.emotion}
              </span>
            )}
          </div>
          {selectedSentence.annotation && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-primary mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Literary Analysis
              </p>
              <p className="text-[14px] leading-[1.7] text-foreground/85">
                {selectedSentence.annotation}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <MessageSquare className="w-6 h-6 text-muted-foreground/30 mb-2" />
          <p className="text-[12px] text-muted-foreground">
            Tap any sentence to see its annotation
          </p>
        </div>
      )}

      <div className="h-px bg-border" />

      {/* Characters */}
      {book.characters.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <User className="w-3 h-3" />
            Characters
          </p>
          <div className="space-y-2">
            {book.characters.map((char) => (
              <div key={char.id} className="p-2.5 rounded border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: char.color }} aria-hidden="true" />
                  <span className="text-[13px] font-semibold">{char.name}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{char.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Themes */}
      {book.themes.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Themes
          </p>
          <div className="space-y-1.5">
            {book.themes.map((theme, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                <span className="text-[12px]">{theme}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Persistent chat — always pinned at bottom. Collapsed: just input bar. Expanded: messages + input.
 */
function PersistentChat({
  book,
  selectedSentence,
  expanded,
  onToggleExpand,
}: {
  book: Book;
  selectedSentence: Sentence | null;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const {
    messages,
    isGenerating,
    engineStatus,
    downloadProgress,
    sendMessage,
    cancel,
    clearMessages,
    initEngine,
  } = useLLMChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const systemPrompt = `You are a literary analysis AI assistant embedded in a reading app called Storyworld. You are currently helping the reader analyze "${book.title}" by ${book.author}. The book's themes include: ${book.themes.join(', ')}. Characters include: ${book.characters.map(c => `${c.name} (${c.description})`).join('; ')}. ${selectedSentence ? `The reader has selected this passage: "${selectedSentence.text}"` : ''} Provide insightful, concise literary analysis. Keep responses under 150 words.`;

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    if (engineStatus !== 'ready') {
      initEngine();
      return;
    }
    sendMessage(input, systemPrompt);
    setInput("");
    if (!expanded) onToggleExpand();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = engineStatus === 'downloading' || engineStatus === 'loading';
  const needsInit = engineStatus === 'idle' || engineStatus === 'error';

  return (
    <div className={cn("border-t border-border bg-card flex flex-col", expanded && "flex-1 min-h-0")}>
      {/* Expand/collapse header */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            AI Chat
          </span>
          {messages.length > 0 && (
            <span className="text-[9px] font-mono text-primary/60">{messages.length} msgs</span>
          )}
          {isLoading && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {engineStatus === 'downloading' ? `${downloadProgress}%` : 'Loading...'}
            </span>
          )}
        </div>
        <ChevronUp className={cn("w-3 h-3 text-muted-foreground transition-transform", !expanded && "rotate-180")} />
      </button>

      {/* Expanded chat messages */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
              {needsInit && messages.length === 0 && (
                <div className="text-center py-4">
                  <Brain className="w-6 h-6 text-primary/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground mb-2">
                    On-device AI · No data leaves your browser
                  </p>
                  <button
                    onClick={initEngine}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-mono hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Download Model (~350MB)
                  </button>
                  <p className="text-[9px] text-muted-foreground/50 mt-2">One-time download, cached locally</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-foreground border border-border"
                  )}>
                    {msg.content}
                    {isGenerating && i === messages.length - 1 && msg.role === 'assistant' && (
                      <span className="inline-block w-1.5 h-3 bg-primary/60 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {messages.length > 0 && (
              <div className="px-3 pb-1">
                <button onClick={clearMessages} className="text-[9px] text-muted-foreground hover:text-foreground font-mono">
                  Clear chat
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always-visible input */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/50 border border-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (!expanded && messages.length > 0) onToggleExpand(); }}
            placeholder={needsInit ? "Type to start AI chat..." : "Ask about this book..."}
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
            disabled={isGenerating || isLoading}
          />
          {isGenerating ? (
            <button onClick={cancel} className="text-destructive hover:text-destructive/80" aria-label="Cancel generation">
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-primary hover:text-primary/80 disabled:text-muted-foreground/30"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
