"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import { Message } from "./message";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({ transport });

  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <>
      <div ref={scrollRef} style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>Ask me anything.</p>
            <p style={styles.emptyHint}>
              I&apos;ll answer with interactive visualizations when a picture is
              worth a thousand tokens.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} role={m.role as "user" | "assistant"} parts={m.parts} />
        ))}
        {isLoading && (
          <div style={styles.thinking}>
            <span style={styles.thinkingDot} />
            {status === "submitted" ? "Thinking..." : "Generating..."}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How does the auth flow work?"
          style={styles.input}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            ...styles.send,
            opacity: isLoading || !input.trim() ? 0.3 : 1,
          }}
        >
          Send
        </button>
      </form>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 0",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  emptyTitle: {
    fontSize: "1.25rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  emptyHint: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    maxWidth: "360px",
    textAlign: "center",
    lineHeight: 1.5,
  },
  thinking: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    padding: "4px 0",
  },
  thinkingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--accent)",
  },
  form: {
    display: "flex",
    gap: "8px",
    padding: "16px 0 24px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    fontSize: "0.9375rem",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    outline: "none",
    transition: "border-color 0.15s",
  },
  send: {
    padding: "12px 20px",
    fontSize: "0.875rem",
    fontWeight: 500,
    background: "var(--accent)",
    color: "var(--bg)",
    border: "none",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};
