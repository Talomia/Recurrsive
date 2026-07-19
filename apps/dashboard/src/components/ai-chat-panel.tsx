"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { X, Send, Sparkles, Bot, Loader2, User, AlertTriangle } from "lucide-react";
import { sendAssistantChat, type AssistantChatMessage } from "@/lib/api/assistant";
import { useAssistant } from "./assistant-context";

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
  /** Active project id — the assistant grounds answers in this project. */
  projectId?: string;
}

// ── Constants ────────────────────────────────────────────

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Recurrsive AI. Ask me about your codebase analysis — findings, opportunities, health, or architecture — and I'll answer using this project's real data.",
  timestamp: new Date(),
};

// ── Component ────────────────────────────────────────────

export default function AiChatPanel({ open, onClose, projectId }: AiChatPanelProps) {
  const { availability, reason, reportStatus } = useAssistant();
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

  // Focus input when panel opens; restore focus to the opener when it closes.
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
    // Closed: return focus to whatever opened the drawer.
    previousFocusRef.current?.focus?.();
    previousFocusRef.current = null;
    return undefined;
  }, [open]);

  // Close on Escape + trap Tab focus inside the open drawer.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Send message — calls the real assistant endpoint.
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Build the conversation history the server expects (roles + content).
      const history: AssistantChatMessage[] = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      // Auto-resize textarea back to default
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      let replyText: string;
      try {
        const res = await sendAssistantChat(history, projectId);
        reportStatus(res.status, res.reason);
        if (res.status === "unavailable") {
          replyText =
            res.message ||
            "The assistant is unavailable — configure an LLM API key (RECURRSIVE_LLM_API_KEY) on the server to enable it.";
        } else if (res.status === "error") {
          replyText = res.message || "The assistant returned an error. Please try again.";
        } else {
          replyText = res.message || "(The assistant returned an empty response.)";
        }
      } catch {
        reportStatus("error");
        replyText =
          "Couldn't reach the assistant service. Check that the API server is running and try again.";
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: replyText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    },
    [isTyping, messages, projectId, reportStatus]
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
        // When closed the drawer stays mounted (for the slide transition) but
        // must not keep focusable controls in the page tab order.
        inert={!open}
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[95] flex h-full w-full max-w-[400px] flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "rgba(10, 10, 20, 0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: open
            ? "-20px 0 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(139, 92, 246, 0.06)"
            : "none",
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
                Recurrsive AI
              </h2>
              <p className="text-[10px] text-text-muted flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full inline-block ${
                    availability === "available"
                      ? "bg-green-400"
                      : availability === "unavailable"
                        ? "bg-amber-400"
                        : "bg-text-muted"
                  }`}
                />
                {availability === "available"
                  ? "Online"
                  : availability === "unavailable"
                    ? "Unavailable — no LLM key"
                    : "Checking availability…"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
            aria-label="Close AI assistant"
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
          {availability === "unavailable" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-300 leading-relaxed">
                {reason ?? "Assistant unavailable — configure an LLM key to enable it."}
              </p>
            </div>
          )}
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
            Recurrsive AI · Answers are grounded in your project&apos;s analysis
          </p>
        </div>
      </aside>
    </>
  );
}
