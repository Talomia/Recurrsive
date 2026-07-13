"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { X, Send, Sparkles, Bot, Loader2, User } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── Constants ────────────────────────────────────────────

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I search the selected project's real findings and opportunities. Ask about a severity, category, risk, or exact finding title.",
  timestamp: new Date(),
};

// ── Component ────────────────────────────────────────────

export default function AiChatPanel({ open, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus the drawer, lock background scrolling, and restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  // Close on Escape and keep keyboard focus inside the modal drawer.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]',
        ) ?? [],
      ).filter((element) => element.tabIndex !== -1);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      // Auto-resize textarea back to default
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      let answer: string;
      try {
        const response = await apiFetch<{ answer: string }>("/api/v1/assistant/query", {
          method: "POST",
          body: JSON.stringify({ question: content.trim() }),
        });
        answer = response.answer;
      } catch {
        answer = "I couldn't query the selected project's analysis. Check the API connection or run an analysis, then try again.";
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    },
    [isTyping]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (value: string) => {
    setInput(value);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Format time
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // A translated off-canvas dialog is still exposed to screen readers and
  // keyboard navigation. Do not mount it until the user opens the assistant.
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Analysis Search"
        className="fixed right-0 top-0 z-[95] flex h-full w-full max-w-[400px] flex-col"
        style={{
          background: "rgba(10, 10, 20, 0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "-20px 0 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(139, 92, 246, 0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 border border-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-400" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Analysis Assistant
              </h2>
              <p className="text-[10px] text-text-muted flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                Live analysis evidence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
            aria-label="Close analysis search"
          >
            <X className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20"
                    : "bg-gradient-to-br from-accent-blue/20 to-cyan-500/20 border border-blue-500/20"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
                ) : (
                  <User className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === "assistant"
                    ? "bg-white/[0.04] border border-white/[0.06] rounded-tl-md"
                    : "bg-accent-blue/10 border border-blue-500/15 rounded-tr-md"
                }`}
              >
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
                <p className="text-[9px] text-text-tertiary mt-1.5 select-none">
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20">
                <Bot className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-1" aria-label="AI is typing">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 px-4 py-3">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 focus-within:border-purple-500/30 transition-colors"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your codebase…"
              aria-label="Type a message"
              rows={1}
              disabled={isTyping}
              className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-h-[24px] max-h-[120px] leading-relaxed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue text-white transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="text-[9px] text-text-tertiary mt-2 text-center select-none">
            Deterministic search over the selected project&apos;s recorded evidence
          </p>
        </div>
      </aside>
    </>
  );
}
