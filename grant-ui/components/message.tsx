"use client";

import { parseMessage } from "@/lib/artifact-parser";
import { Artifact } from "./artifact";

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface MessageProps {
  role: "user" | "assistant";
  parts: MessagePart[];
}

export function Message({ role, parts }: MessageProps) {
  // Extract text content from parts
  const textContent = parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");

  if (role === "user") {
    return (
      <div style={styles.userRow}>
        <div style={styles.userBubble}>{textContent}</div>
      </div>
    );
  }

  if (!textContent) return null;

  const segments = parseMessage(textContent);

  return (
    <div style={styles.assistantRow}>
      {segments.map((seg, i) =>
        seg.type === "artifact" ? (
          <Artifact key={i} path={seg.path} title={seg.title} />
        ) : (
          <div key={i} style={styles.assistantText}>
            {seg.content}
          </div>
        )
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  userRow: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 0",
  },
  userBubble: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: "var(--radius)",
    background: "var(--bg-raised)",
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    lineHeight: 1.5,
  },
  assistantRow: {
    padding: "4px 0",
  },
  assistantText: {
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
};
