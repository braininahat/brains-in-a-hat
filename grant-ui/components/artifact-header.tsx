"use client";

interface ArtifactHeaderProps {
  title: string;
  expanded: boolean;
  onToggleExpand: () => void;
  html: string;
}

export function ArtifactHeader({
  title,
  expanded,
  onToggleExpand,
  html,
}: ArtifactHeaderProps) {
  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(html);
  };

  return (
    <div style={styles.header}>
      <span style={styles.title}>{title}</span>
      <div style={styles.actions}>
        <button onClick={handleCopyHtml} style={styles.button} title="Copy HTML">
          Copy
        </button>
        <button onClick={handleDownload} style={styles.button} title="Download">
          Save
        </button>
        <button onClick={onToggleExpand} style={styles.button} title={expanded ? "Collapse" : "Expand"}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-raised)",
  },
  title: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--accent)",
    letterSpacing: "-0.01em",
  },
  actions: {
    display: "flex",
    gap: "4px",
  },
  button: {
    padding: "4px 10px",
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  },
};
