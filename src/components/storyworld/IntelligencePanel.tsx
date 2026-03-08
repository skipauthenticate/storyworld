import { Sentence, Book } from "@/data/sampleBooks";
import { X, BookOpen, MessageSquare, Sparkles, User, Send, Loader2, Download, Brain, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useLLMChat } from "@/hooks/useLLMChat";
import { ResearchPanel } from "./ResearchPanel";

interface IntelligencePanelProps {
  selectedSentence: Sentence | null;
  book: Book;
  showCharacters: boolean;
  showThemes?: boolean;
  onClose: () => void;
  onCloseCharacters: () => void;
  onCloseThemes?: () => void;
  className?: string;
}

export function IntelligencePanel({
  selectedSentence,
  book,
  showCharacters,
  showThemes,
  onClose,
  onCloseCharacters,
  onCloseThemes,
  className,
}: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<"annotation" | "characters" | "themes" | "chat">("annotation");

  useEffect(() => {
    if (showCharacters) setActiveTab("characters");
  }, [showCharacters]);

  useEffect(() => {
    if (showThemes) setActiveTab("themes");
  }, [showThemes]);

  const tabs = [
    { id: "annotation" as const, label: "Annotation", icon: BookOpen },
    { id: "characters" as const, label: "Characters", icon: User },
    { id: "themes" as const, label: "Themes", icon: Sparkles },
    { id: "chat" as const, label: "AI Chat", icon: Brain },
  ];

  return (
    <aside className={cn("w-[340px] min-w-[340px] h-full flex flex-col border-l border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Intelligence
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-mono transition-colors border-b-2",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "annotation" && (
            <AnnotationTab key="annotation" selectedSentence={selectedSentence} />
          )}
          {activeTab === "characters" && (
            <CharactersTab key="characters" book={book} />
          )}
          {activeTab === "themes" && (
            <ThemesTab key="themes" book={book} />
          )}
          {activeTab === "chat" && (
            <ChatTab key="chat" book={book} selectedSentence={selectedSentence} />
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function AnnotationTab({ selectedSentence }: { selectedSentence: Sentence | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="p-4"
    >
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
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Tap any sentence to see its annotation
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Literary analysis, character insights, and cross-references
          </p>
        </div>
      )}
    </motion.div>
  );
}

function CharactersTab({ book }: { book: Book }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-3 p-4"
    >
      {book.characters.map((char) => (
        <div
          key={char.id}
          className="p-3 rounded border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: char.color }}
            />
            <span className="text-[14px] font-semibold">{char.name}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {char.description}
          </p>
          {char.appearances.length > 0 && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
              Appears in Ch. {char.appearances.join(", ")}
            </p>
          )}
        </div>
      ))}
    </motion.div>
  );
}

function ThemesTab({ book }: { book: Book }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-2 p-4"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
        Major Themes
      </p>
      {book.themes.map((theme, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[13px]">{theme}</span>
        </div>
      ))}
    </motion.div>
  );
}

function ChatTab({ book, selectedSentence }: { book: Book; selectedSentence: Sentence | null }) {
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const systemPrompt = `You are a literary analysis AI assistant embedded in a reading app called Storyworld. You are currently helping the reader analyze "${book.title}" by ${book.author}. The book's themes include: ${book.themes.join(', ')}. Characters include: ${book.characters.map(c => `${c.name} (${c.description})`).join('; ')}. ${selectedSentence ? `The reader has selected this passage: "${selectedSentence.text}"` : ''} Provide insightful, concise literary analysis. Keep responses under 150 words.`;

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    sendMessage(input, systemPrompt);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (engineStatus === 'idle' || engineStatus === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center justify-center h-full p-6 text-center"
      >
        <Brain className="w-10 h-10 text-primary/40 mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">On-Device AI Chat</p>
        <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
          Chat with Qwen2.5-0.5B running entirely in your browser via RunAnywhere. No data leaves your device.
        </p>
        {engineStatus === 'error' && (
          <p className="text-[11px] text-destructive mb-3">
            Failed to initialize. Click below to retry.
          </p>
        )}
        <button
          onClick={initEngine}
          className="px-4 py-2 rounded bg-primary text-primary-foreground text-[12px] font-mono hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          Download Model (~350MB)
        </button>
        <p className="text-[10px] text-muted-foreground/50 mt-3">
          One-time download, cached locally
        </p>
      </motion.div>
    );
  }

  if (engineStatus === 'downloading' || engineStatus === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center justify-center h-full p-6 text-center"
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-foreground mb-2">
          {engineStatus === 'downloading' ? 'Downloading Model...' : 'Loading into WASM...'}
        </p>
        {engineStatus === 'downloading' && (
          <>
            <div className="w-full max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden mb-2">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{downloadProgress}%</p>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full"
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain className="w-6 h-6 text-primary/30 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">
              Ask about the book, characters, themes, or any selected passage.
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Powered by Qwen2.5 · RunAnywhere · 100% on-device
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                msg.role === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground border border-border"
              )}
            >
              {msg.content}
              {isGenerating && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/60 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-[10px] text-muted-foreground hover:text-foreground mb-2 font-mono"
          >
            Clear chat
          </button>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/50 border border-border">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this book..."
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
            disabled={isGenerating}
          />
          {isGenerating ? (
            <button onClick={cancel} className="text-destructive hover:text-destructive/80">
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="text-primary hover:text-primary/80 disabled:text-muted-foreground/30"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
