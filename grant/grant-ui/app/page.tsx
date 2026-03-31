"use client";

import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";

interface Artifact {
  title: string;
  html: string;
}

function parseArtifacts(text: string): { before: string; artifact: Artifact | null; after: string } {
  const match = text.match(/```html_artifact\s+title="([^"]+)"\n([\s\S]*?)```/);
  if (!match) return { before: text, artifact: null, after: "" };
  const idx = match.index!;
  return {
    before: text.slice(0, idx).trim(),
    artifact: { title: match[1], html: match[2].trim() },
    after: text.slice(idx + match[0].length).trim(),
  };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(520);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput("");
    setResponse("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setResponse(full);
      }
    } finally {
      setLoading(false);
    }
  };

  // Only parse artifacts when done streaming — don't show raw HTML mid-stream
  const hasArtifactBlock = response.includes("```html_artifact");
  const artifactComplete = hasArtifactBlock && response.includes("```\n") && response.lastIndexOf("```") > response.indexOf("```html_artifact") + 10;
  const { before, artifact, after } = artifactComplete ? parseArtifacts(response) : { before: "", artifact: null, after: "" };

  // Show text before the artifact block while streaming (but not the HTML itself)
  const streamingBefore = !artifactComplete && hasArtifactBlock
    ? response.slice(0, response.indexOf("```html_artifact")).trim()
    : (!hasArtifactBlock && !loading ? response : (!hasArtifactBlock ? "" : ""));

  // Extract title from partial stream
  const partialTitleMatch = response.match(/```html_artifact\s+title="([^"]+)"/);
  const partialTitle = partialTitleMatch?.[1];

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>Grant</h1>
        <p style={styles.subtitle}>show, don&apos;t tell</p>
      </header>

      <div ref={scrollRef} style={styles.content}>
        {!response && !loading && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>Ask me anything.</p>
            <p style={styles.emptyHint}>
              I&apos;ll answer with publication-quality figures — diagrams, architecture maps, concept explanations.
            </p>
          </div>
        )}

        {/* Text before artifact (both during and after streaming) */}
        {(before || streamingBefore) && <div className="prose"><Markdown>{before || streamingBefore}</Markdown></div>}

        {/* Loading placeholder while artifact is being generated */}
        {loading && hasArtifactBlock && !artifactComplete && (
          <div style={styles.artifact}>
            <div style={styles.artifactHeader}>
              <span style={styles.artifactTitle}>{partialTitle || "Generating..."}</span>
            </div>
            <div style={styles.placeholder}>
              <div style={styles.spinner} />
              <span style={styles.placeholderText}>Creating figure...</span>
            </div>
          </div>
        )}

        {/* Completed artifact */}
        {artifact && (
          <div style={expanded ? styles.artifactExpanded : styles.artifact}>
            <div style={styles.artifactHeader}>
              <span style={styles.artifactTitle}>{artifact.title}</span>
              <div style={styles.artifactActions}>
                <button onClick={() => navigator.clipboard.writeText(artifact.html)} style={styles.btn}>Copy</button>
                <button onClick={() => {
                  const b = new Blob([artifact.html], { type: "text/html" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(b);
                  a.download = `${artifact.title.toLowerCase().replace(/\s+/g, "-")}.html`;
                  a.click();
                }} style={styles.btn}>Save</button>
                <button onClick={() => setExpanded(!expanded)} style={styles.btn}>
                  {expanded ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            <iframe
              ref={iframeRef}
              srcDoc={artifact.html}
              sandbox="allow-scripts allow-same-origin"
              style={expanded ? styles.iframeExpanded : { ...styles.iframe, height: `${iframeHeight}px` }}
              title={artifact.title}
              onLoad={() => {
                try {
                  const doc = iframeRef.current?.contentDocument;
                  if (doc) {
                    const h = doc.documentElement.scrollHeight;
                    if (h > 100) setIframeHeight(Math.min(h + 20, 1200));
                  }
                } catch { /* cross-origin fallback */ }
              }}
            />
          </div>
        )}

        {after && <div className="prose"><Markdown>{after}</Markdown></div>}

        {/* Initial thinking state (before any content) */}
        {loading && !response && (
          <div style={styles.loading}>
            <span style={styles.dot} />
            Thinking...
          </div>
        )}

        {/* Text-only response still streaming */}
        {loading && response && !hasArtifactBlock && (
          <div className="prose"><Markdown>{response}</Markdown></div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {response && !loading && (
          <button type="button" onClick={() => setResponse("")} style={styles.clearBtn}>Clear</button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How does JEPA work?"
          style={styles.input}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{ ...styles.send, opacity: loading || !input.trim() ? 0.3 : 1 }}
        >
          Send
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { display: "flex", flexDirection: "column", height: "100vh", maxWidth: "960px", margin: "0 auto", padding: "0 24px" },
  header: { padding: "24px 0 16px", borderBottom: "1px solid #e8e4dc", flexShrink: 0 },
  title: { fontSize: "1.125rem", fontWeight: 500, color: "#2d2d2d", letterSpacing: "-0.01em" },
  subtitle: { fontSize: "0.8125rem", color: "#999", marginTop: "4px" },
  content: { flex: 1, overflowY: "auto", padding: "24px 0" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px" },
  emptyTitle: { fontSize: "1.25rem", fontWeight: 500, color: "#666" },
  emptyHint: { fontSize: "0.875rem", color: "#999", maxWidth: "380px", textAlign: "center", lineHeight: 1.5 },
  text: { fontSize: "0.9375rem", lineHeight: 1.6, color: "#2d2d2d", margin: "12px 0" },
  artifact: { border: "1px solid #e8e4dc", borderRadius: "8px", overflow: "hidden", margin: "16px 0", background: "#fff" },
  artifactExpanded: { position: "fixed", inset: "16px", zIndex: 100, border: "1px solid #e8e4dc", borderRadius: "8px", overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" },
  artifactHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #e8e4dc", background: "#fafaf8" },
  artifactTitle: { fontSize: "0.8125rem", fontWeight: 500, color: "#8b7355" },
  artifactActions: { display: "flex", gap: "4px" },
  btn: { padding: "4px 10px", fontSize: "0.75rem", color: "#999", background: "transparent", border: "1px solid #e8e4dc", borderRadius: "4px", cursor: "pointer" },
  iframe: { width: "100%", height: "520px", border: "none", background: "#fafaf8" },
  iframeExpanded: { width: "100%", flex: 1, border: "none", background: "#fafaf8" },
  placeholder: { display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", height: "320px", gap: "16px", background: "#fafaf8" },
  spinner: { width: "24px", height: "24px", border: "2px solid #e8e4dc", borderTopColor: "#c9a87c", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  placeholderText: { fontSize: "0.8125rem", color: "#999" },
  loading: { display: "flex", alignItems: "center", gap: "8px", color: "#999", fontSize: "0.875rem", padding: "16px 0" },
  dot: { width: "6px", height: "6px", borderRadius: "50%", background: "#c9a87c", animation: "pulse 1.5s ease-in-out infinite" },
  form: { display: "flex", gap: "8px", padding: "16px 0 24px", borderTop: "1px solid #e8e4dc", flexShrink: 0 },
  input: { flex: 1, padding: "12px 16px", fontSize: "0.9375rem", background: "#fafaf8", border: "1px solid #e8e4dc", borderRadius: "8px", color: "#2d2d2d", outline: "none" },
  send: { padding: "12px 20px", fontSize: "0.875rem", fontWeight: 500, background: "#8b7355", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" },
  clearBtn: { padding: "12px 16px", fontSize: "0.875rem", color: "#999", background: "transparent", border: "1px solid #e8e4dc", borderRadius: "8px", cursor: "pointer" },
};
