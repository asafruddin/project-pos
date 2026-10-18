"use client";

import { Button } from "@pos-apps/ui/atoms";
import type { AssistantActionProposal } from "@pos-apps/types";
import { CheckCircleIcon, LightningIcon, XCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { authorizedFetch } from "@/lib/api-client";
import { canApplyProposal, proposalRequest } from "@/lib/assistant-actions";
import { cn } from "@/lib/utils";

export type AssistantDecision =
  | { status: "applied"; message: string }
  | { status: "cancelled" };

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    // Non-JSON error body.
  }
  return "Perubahan gagal disimpan.";
}

/**
 * Preview of a `propose_*` tool result. Konfirmasi calls the same endpoint the
 * regular Dashboard form uses, so server guards and validation still apply.
 */
export function AssistantActionCard({
  proposal,
  permissions,
  decision,
  disabled,
  onDecision,
}: {
  proposal: AssistantActionProposal;
  permissions: string[] | undefined;
  decision: AssistantDecision | undefined;
  disabled: boolean;
  onDecision: (decision: AssistantDecision) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = canApplyProposal(proposal, permissions);

  async function confirm() {
    const request = proposalRequest(proposal);
    if (!request) {
      setError("Usulan tidak valid.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(request.path, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      const summary = proposal.changes
        .map((c) => (c.from ? `${c.field}: ${c.from} → ${c.to}` : `${c.field}: ${c.to}`))
        .join("; ");
      onDecision({ status: "applied", message: `${proposal.title} (${summary})` });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Server tidak dapat dihubungi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 text-sm",
        decision?.status === "applied" ? "border-emerald-500/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <LightningIcon size={16} weight="bold" className="text-primary" />
        <span>{proposal.title}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {proposal.changes.map((change) => (
          <div key={change.field} className="contents">
            <dt className="text-muted-foreground">{change.field}</dt>
            <dd className="min-w-0 break-words">
              {change.from ? (
                <>
                  <span className="text-muted-foreground line-through">{change.from}</span>{" "}
                  → <span className="font-medium">{change.to}</span>
                </>
              ) : (
                <span className="font-medium">{change.to}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {decision?.status === "applied" ? (
        <p className="mt-3 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircleIcon size={16} weight="fill" /> Sudah diterapkan.
        </p>
      ) : decision?.status === "cancelled" ? (
        <p className="mt-3 flex items-center gap-1.5 text-muted-foreground">
          <XCircleIcon size={16} weight="fill" /> Dibatalkan.
        </p>
      ) : !allowed ? (
        <p className="mt-3 text-muted-foreground">Akun ini tidak dapat menerapkan perubahan ini.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending || disabled} onClick={confirm}>
            {pending ? "Menyimpan…" : "Konfirmasi"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || disabled}
            onClick={() => onDecision({ status: "cancelled" })}
          >
            Batal
          </Button>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
