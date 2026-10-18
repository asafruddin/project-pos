"use client";

import { HBarChart } from "@pos-apps/ui/organisms";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { isActionProposal } from "@/lib/assistant-actions";
import { formatIdr } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { AssistantActionCard, type AssistantDecision } from "./assistant-action-card";
import { AssistantMarkdown } from "./assistant-markdown";

const TOOL_LABELS: Record<string, string> = {
  get_sales_summary: "Mengambil ringkasan penjualan",
  get_product_ranking: "Mengambil peringkat produk",
  get_cashier_performance: "Mengambil kinerja kasir",
  get_inventory_insights: "Mengambil analitik stok",
  get_stock_levels: "Mengecek stok",
  search_products: "Mencari produk",
  search_customers: "Mencari pelanggan",
};

type RankingOutput = {
  products?: Array<{ name: string; units: number; revenue_minor: number }>;
};
type CashierOutput = {
  cashiers?: Array<{ cashier: string; revenue_minor: number; txn_count: number }>;
};

function ToolChart({ name, output }: { name: string; output: unknown }) {
  if (name === "get_product_ranking") {
    const rows = (output as RankingOutput).products ?? [];
    if (rows.length === 0) return null;
    return (
      <HBarChart
        data={rows.map((row) => ({
          label: row.name,
          value: row.units,
          hint: `${row.units} unit · ${formatIdr(row.revenue_minor)}`,
        }))}
      />
    );
  }
  if (name === "get_cashier_performance") {
    const rows = (output as CashierOutput).cashiers ?? [];
    if (rows.length === 0) return null;
    return (
      <HBarChart
        data={rows.map((row) => ({
          label: row.cashier,
          value: row.revenue_minor,
          hint: `${formatIdr(row.revenue_minor)} · ${row.txn_count} trx`,
        }))}
      />
    );
  }
  return null;
}

export function AssistantMessage({
  message,
  permissions,
  decisions,
  busy,
  onDecision,
}: {
  message: UIMessage;
  permissions: string[] | undefined;
  decisions: Record<string, AssistantDecision>;
  busy: boolean;
  onDecision: (toolCallId: string, decision: AssistantDecision) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (isTextUIPart(part)) {
          if (!part.text.trim()) return null;
          return isUser ? (
            <div
              key={key}
              className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
            >
              {part.text}
            </div>
          ) : (
            <div key={key} className="max-w-full">
              <AssistantMarkdown text={part.text} />
            </div>
          );
        }

        if (!isToolUIPart(part)) return null;
        const name = getToolName(part);

        if (part.state === "input-streaming" || part.state === "input-available") {
          return (
            <p key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleNotchIcon size={12} className="animate-spin" />
              {TOOL_LABELS[name] ?? "Menyiapkan usulan"}…
            </p>
          );
        }
        if (part.state === "output-error") {
          return (
            <p key={key} className="text-xs text-muted-foreground">
              Gagal memproses {TOOL_LABELS[name]?.toLowerCase() ?? name}.
            </p>
          );
        }
        if (part.state !== "output-available") return null;

        if (name.startsWith("propose_") && isActionProposal(part.output)) {
          return (
            <div key={key} className="w-full">
              <AssistantActionCard
                proposal={part.output}
                permissions={permissions}
                decision={decisions[part.toolCallId]}
                disabled={busy}
                onDecision={(decision) => onDecision(part.toolCallId, decision)}
              />
            </div>
          );
        }
        return (
          <div key={key} className="w-full">
            <ToolChart name={name} output={part.output} />
          </div>
        );
      })}
    </div>
  );
}
