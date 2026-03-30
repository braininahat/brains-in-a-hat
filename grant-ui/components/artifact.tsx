"use client";

import { useState, useRef, useEffect } from "react";
import { ArtifactHeader } from "./artifact-header";

interface ArtifactProps {
  path: string;
  title: string;
}

export function Artifact({ path, title }: ArtifactProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch(`/api/artifact?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load artifact: ${r.status}`);
        return r.text();
      })
      .then(setHtml)
      .catch((e) => setError(e.message));
  }, [path]);

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <span style={styles.errorText}>Could not load {path}</span>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingDot} />
        Loading visualization...
      </div>
    );
  }

  return (
    <div style={expanded ? styles.expandedWrapper : styles.wrapper}>
      <ArtifactHeader
        title={title}
        path={path}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
        html={html}
      />
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts"
        style={expanded ? styles.iframeExpanded : styles.iframe}
        title={title}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    margin: "8px 0",
    background: "var(--bg-surface)",
  },
  expandedWrapper: {
    position: "fixed",
    inset: "16px",
    zIndex: 100,
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    background: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
  },
  iframe: {
    width: "100%",
    height: "480px",
    border: "none",
    background: "#1a1a2e",
  },
  iframeExpanded: {
    width: "100%",
    flex: 1,
    border: "none",
    background: "#1a1a2e",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "16px",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
  },
  loadingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--accent)",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  errorContainer: {
    padding: "12px 16px",
    border: "1px solid #3a2020",
    borderRadius: "var(--radius)",
    background: "#1a1015",
    margin: "8px 0",
  },
  errorText: {
    color: "#c97070",
    fontSize: "0.875rem",
  },
};
