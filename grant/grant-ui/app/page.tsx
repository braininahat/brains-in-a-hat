import { Chat } from "@/components/chat";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "0 24px",
      }}
    >
      <header
        style={{
          padding: "24px 0 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: "1.125rem",
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Grant
        </h1>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-muted)",
            marginTop: "4px",
          }}
        >
          show, don&apos;t tell
        </p>
      </header>
      <Chat />
    </main>
  );
}
