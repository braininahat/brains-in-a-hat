"use client";

import { useState } from "react";
import {
  useUIStream,
  Renderer,
  StateProvider,
  VisibilityProvider,
  ActionProvider,
  ValidationProvider,
} from "@json-render/react";
import { registry } from "@/lib/registry";

export default function Home() {
  const [input, setInput] = useState("");
  const { spec, isStreaming, send, clear } = useUIStream({
    api: "/api/generate",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput("");
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>Grant</h1>
        <p style={styles.subtitle}>show, don&apos;t tell</p>
      </header>

      <div style={styles.content}>
        {!spec && !isStreaming && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>Ask me anything.</p>
            <p style={styles.emptyHint}>
              I&apos;ll answer with interactive visualizations — comparisons,
              architecture diagrams, timelines, dashboards.
            </p>
          </div>
        )}

        {(spec || isStreaming) && (
          <StateProvider initialState={{}}>
            <VisibilityProvider>
              <ActionProvider handlers={{}}>
                <ValidationProvider>
                  <div style={styles.visualization}>
                    <Renderer
                      spec={spec}
                      registry={registry}
                      loading={isStreaming}
                    />
                  </div>
                </ValidationProvider>
              </ActionProvider>
            </VisibilityProvider>
          </StateProvider>
        )}

        {isStreaming && (
          <div style={styles.streaming}>
            <span style={styles.dot} />
            Generating...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {spec && !isStreaming && (
          <button type="button" onClick={clear} style={styles.clearBtn}>
            Clear
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Compare React vs Vue vs Svelte"
          style={styles.input}
          autoFocus
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          style={{
            ...styles.send,
            opacity: isStreaming || !input.trim() ? 0.3 : 1,
          }}
        >
          Send
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: "900px",
    margin: "0 auto",
    padding: "0 24px",
  },
  header: {
    padding: "24px 0 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontSize: "1.125rem",
    fontWeight: 500,
    color: "var(--text)",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
    marginTop: "4px",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 0",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "8px",
  },
  emptyTitle: {
    fontSize: "1.25rem",
    fontWeight: 500,
    color: "var(--text-dim)",
  },
  emptyHint: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    maxWidth: "360px",
    textAlign: "center",
    lineHeight: 1.5,
  },
  visualization: {
    minHeight: "200px",
  },
  streaming: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    padding: "16px 0",
  },
  dot: {
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
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    outline: "none",
  },
  send: {
    padding: "12px 20px",
    fontSize: "0.875rem",
    fontWeight: 500,
    background: "var(--accent)",
    color: "var(--bg)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  clearBtn: {
    padding: "12px 16px",
    fontSize: "0.875rem",
    color: "var(--text-dim)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
  },
};
