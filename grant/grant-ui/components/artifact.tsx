"use client";

import { useState } from "react";
import { ArtifactHeader } from "./artifact-header";

interface ArtifactProps {
  html: string;
  title: string;
}

export function Artifact({ html, title }: ArtifactProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={expanded ? styles.expandedWrapper : styles.wrapper}>
      <ArtifactHeader
        title={title}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
        html={html}
      />
      <iframe
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
};
