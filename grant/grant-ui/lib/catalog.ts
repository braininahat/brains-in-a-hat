import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    Heading: {
      props: z.object({
        title: z.string(),
        level: z.enum(["1", "2", "3"]).nullable(),
        subtitle: z.string().nullable(),
      }),
      description: "Section heading with optional subtitle",
    },

    Text: {
      props: z.object({
        content: z.string(),
        variant: z.enum(["body", "caption", "emphasis"]).nullable(),
      }),
      description: "Text block for paragraphs, captions, or emphasized content",
    },

    MetricCard: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(["up", "down", "neutral"]).nullable(),
        description: z.string().nullable(),
      }),
      description: "Single metric display with optional trend indicator",
    },

    ComparisonTable: {
      props: z.object({
        title: z.string(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
      description: "Side-by-side comparison table with headers and rows",
    },

    FlowDiagram: {
      props: z.object({
        title: z.string(),
        steps: z.array(
          z.object({
            label: z.string(),
            description: z.string().nullable(),
          })
        ),
        direction: z.enum(["horizontal", "vertical"]).nullable(),
      }),
      description:
        "Process or architecture flow showing connected steps in sequence",
    },

    Timeline: {
      props: z.object({
        title: z.string(),
        events: z.array(
          z.object({
            date: z.string(),
            title: z.string(),
            description: z.string().nullable(),
          })
        ),
      }),
      description: "Chronological timeline of events",
    },

    DataTable: {
      props: z.object({
        title: z.string().nullable(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
      description: "Tabular data display with headers and rows",
    },

    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().nullable(),
        title: z.string().nullable(),
      }),
      description: "Formatted code snippet",
    },

    Card: {
      props: z.object({
        title: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Container card for grouping related content",
    },

    Stack: {
      props: z.object({
        direction: z.enum(["horizontal", "vertical"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      slots: ["default"],
      description: "Layout container that arranges children horizontally or vertically",
    },
  },
  actions: {},
});
