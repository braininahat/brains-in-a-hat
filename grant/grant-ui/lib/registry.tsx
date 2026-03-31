import { defineRegistry } from "@json-render/react";
import { catalog } from "./catalog";

export const { registry } = defineRegistry(catalog, {
  components: {
    Heading: ({ props }) => {
      const Tag = `h${props.level || "1"}` as "h1" | "h2" | "h3";
      return (
        <div style={{ margin: "24px 0 12px" }}>
          <Tag
            style={{
              fontSize:
                props.level === "3"
                  ? "1.1rem"
                  : props.level === "2"
                    ? "1.4rem"
                    : "1.75rem",
              fontWeight: 600,
              color: "#e8e6e3",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {props.title}
          </Tag>
          {props.subtitle && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "#9b9a97",
                marginTop: "4px",
              }}
            >
              {props.subtitle}
            </p>
          )}
        </div>
      );
    },

    Text: ({ props }) => (
      <p
        style={{
          fontSize: props.variant === "caption" ? "0.8125rem" : "0.9375rem",
          color:
            props.variant === "caption"
              ? "#9b9a97"
              : props.variant === "emphasis"
                ? "#e09145"
                : "#e8e6e3",
          lineHeight: 1.6,
          margin: "8px 0",
          fontStyle: props.variant === "emphasis" ? "italic" : "normal",
        }}
      >
        {props.content}
      </p>
    ),

    MetricCard: ({ props }) => (
      <div
        style={{
          background: "#1e1e2a",
          borderRadius: "8px",
          padding: "20px",
          border: "1px solid #2a2a36",
          minWidth: "160px",
        }}
      >
        <div
          style={{ fontSize: "0.75rem", color: "#9b9a97", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {props.label}
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#e8e6e3" }}>
          {props.value}
          {props.trend && (
            <span
              style={{
                fontSize: "0.875rem",
                marginLeft: "8px",
                color:
                  props.trend === "up"
                    ? "#3fb950"
                    : props.trend === "down"
                      ? "#f85149"
                      : "#9b9a97",
              }}
            >
              {props.trend === "up" ? "↑" : props.trend === "down" ? "↓" : "→"}
            </span>
          )}
        </div>
        {props.description && (
          <div style={{ fontSize: "0.8125rem", color: "#9b9a97", marginTop: "8px" }}>
            {props.description}
          </div>
        )}
      </div>
    ),

    ComparisonTable: ({ props }) => (
      <div style={{ margin: "16px 0" }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#e09145",
            marginBottom: "12px",
          }}
        >
          {props.title}
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.875rem",
          }}
        >
          <thead>
            <tr>
              {props.headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    borderBottom: "2px solid #2a2a36",
                    color: "#e8e6e3",
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #1e1e2a",
                      color: ci === 0 ? "#e8e6e3" : "#9b9a97",
                      fontWeight: ci === 0 ? 500 : 400,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    FlowDiagram: ({ props }) => {
      const isHorizontal = props.direction !== "vertical";
      return (
        <div style={{ margin: "16px 0" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#e09145",
              marginBottom: "16px",
            }}
          >
            {props.title}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: isHorizontal ? "row" : "column",
              alignItems: isHorizontal ? "center" : "stretch",
              gap: "0",
              flexWrap: "wrap",
            }}
          >
            {props.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexDirection: isHorizontal ? "row" : "column",
                }}
              >
                <div
                  style={{
                    background: "#1e1e2a",
                    border: "1px solid #2a2a36",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    minWidth: "120px",
                  }}
                >
                  <div style={{ fontWeight: 500, color: "#e8e6e3", fontSize: "0.875rem" }}>
                    {step.label}
                  </div>
                  {step.description && (
                    <div style={{ fontSize: "0.75rem", color: "#9b9a97", marginTop: "4px" }}>
                      {step.description}
                    </div>
                  )}
                </div>
                {i < props.steps.length - 1 && (
                  <div
                    style={{
                      color: "#e09145",
                      fontSize: "1.25rem",
                      padding: isHorizontal ? "0 8px" : "8px 0",
                    }}
                  >
                    {isHorizontal ? "→" : "↓"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    },

    Timeline: ({ props }) => (
      <div style={{ margin: "16px 0" }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#e09145",
            marginBottom: "16px",
          }}
        >
          {props.title}
        </div>
        <div style={{ borderLeft: "2px solid #2a2a36", paddingLeft: "20px" }}>
          {props.events.map((event, i) => (
            <div key={i} style={{ marginBottom: "20px", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "-27px",
                  top: "4px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#e09145",
                  border: "2px solid #0f0f17",
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "#9b9a97" }}>
                {event.date}
              </div>
              <div style={{ fontWeight: 500, color: "#e8e6e3", fontSize: "0.875rem", marginTop: "2px" }}>
                {event.title}
              </div>
              {event.description && (
                <div style={{ fontSize: "0.8125rem", color: "#9b9a97", marginTop: "4px" }}>
                  {event.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),

    DataTable: ({ props }) => (
      <div style={{ margin: "16px 0" }}>
        {props.title && (
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#e09145", marginBottom: "12px" }}>
            {props.title}
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr>
              {props.headers.map((h, i) => (
                <th key={i} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2a2a36", color: "#e8e6e3", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "8px 12px", borderBottom: "1px solid #1e1e2a", color: "#9b9a97" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    CodeBlock: ({ props }) => (
      <div style={{ margin: "12px 0" }}>
        {props.title && (
          <div style={{ fontSize: "0.75rem", color: "#9b9a97", marginBottom: "4px" }}>
            {props.title}
          </div>
        )}
        <pre
          style={{
            background: "#16161f",
            border: "1px solid #2a2a36",
            borderRadius: "8px",
            padding: "14px 18px",
            overflow: "auto",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
            color: "#e8e6e3",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        >
          <code>{props.code}</code>
        </pre>
      </div>
    ),

    Card: ({ props, children }) => (
      <div
        style={{
          background: "#16161f",
          border: "1px solid #2a2a36",
          borderRadius: "8px",
          padding: "20px",
          margin: "12px 0",
        }}
      >
        {props.title && (
          <div style={{ fontWeight: 600, color: "#e8e6e3", marginBottom: "12px", fontSize: "0.9375rem" }}>
            {props.title}
          </div>
        )}
        {children}
      </div>
    ),

    Stack: ({ props, children }) => (
      <div
        style={{
          display: "flex",
          flexDirection: props.direction === "horizontal" ? "row" : "column",
          gap: props.gap === "lg" ? "24px" : props.gap === "sm" ? "8px" : "16px",
          flexWrap: "wrap",
        }}
      >
        {children}
      </div>
    ),
  },
});
