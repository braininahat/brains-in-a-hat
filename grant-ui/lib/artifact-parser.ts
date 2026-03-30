/**
 * Detect and extract artifact markers from Grant's output.
 *
 * Grant emits markers like:
 *   [ARTIFACT: .claude/grant/auth-flow.html "Auth Flow Diagram"]
 *
 * This parser splits a message into segments: text and artifact references.
 */

export interface ArtifactRef {
  type: "artifact";
  path: string;
  title: string;
}

export interface TextSegment {
  type: "text";
  content: string;
}

export type MessageSegment = ArtifactRef | TextSegment;

const ARTIFACT_RE = /\[ARTIFACT:\s*([^\s"]+)\s+"([^"]+)"\]/g;

export function parseMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(ARTIFACT_RE)) {
    const matchStart = match.index!;

    // Text before this artifact
    if (matchStart > lastIndex) {
      const text = content.slice(lastIndex, matchStart).trim();
      if (text) {
        segments.push({ type: "text", content: text });
      }
    }

    segments.push({
      type: "artifact",
      path: match[1],
      title: match[2],
    });

    lastIndex = matchStart + match[0].length;
  }

  // Trailing text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: "text", content: text });
    }
  }

  // No artifacts found — return as single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: "text", content: content.trim() });
  }

  return segments;
}
