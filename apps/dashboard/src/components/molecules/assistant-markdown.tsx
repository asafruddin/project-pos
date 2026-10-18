"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <p className="mt-3 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mt-3 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mt-3 font-semibold">{children}</p>,
  a: ({ children }) => <span className="underline">{children}</span>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border/60 px-2 py-1">{children}</td>,
};

/** Model text. Raw HTML is not rendered and links are shown as plain text. */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
