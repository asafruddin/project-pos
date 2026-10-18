"use client";

import { useChat } from "@ai-sdk/react";
import { Button, Textarea } from "@pos-apps/ui/atoms";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@pos-apps/ui/molecules";
import type { AssistantStatusResponse } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import {
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AssistantDecision } from "@/components/molecules/assistant-action-card";
import { AssistantMessage } from "@/components/molecules/assistant-message";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { authorizedFetch } from "@/lib/api-client";
import {
  assistantErrorText,
  createAssistantTransport,
  loadAssistantMessages,
  saveAssistantMessages,
} from "@/lib/assistant-chat";

const DECISIONS_KEY = "pos_apps_assistant_decisions";

function loadDecisions(): Record<string, AssistantDecision> {
  try {
    const raw = window.sessionStorage.getItem(DECISIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, AssistantDecision>) : {};
  } catch {
    return {};
  }
}

function saveDecisions(decisions: Record<string, AssistantDecision>): void {
  try {
    window.sessionStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  } catch {
    // Blocked storage: decisions just won't survive a reload.
  }
}

function suggestionsFor(permissions: string[] | undefined): string[] {
  const out: string[] = [];
  if (hasPermission(permissions, "reports", "view")) {
    out.push("Produk apa yang paling laku minggu ini?");
    out.push("Bandingkan omzet minggu ini dengan minggu lalu");
  }
  if (hasPermission(permissions, "inventory", "view")) {
    out.push("Produk apa saja yang stoknya hampir habis?");
  }
  if (hasPermission(permissions, "promotions", "create")) {
    out.push("Buat promo diskon 10% untuk produk yang paling tidak laku bulan ini");
  }
  return out;
}

/** Header button + side sheet. Stays mounted so the chat survives navigation. */
export function AssistantLauncher() {
  const me = useDashboardSession();
  const [status, setStatus] = useState<AssistantStatusResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [decisions, setDecisions] = useState<Record<string, AssistantDecision>>(loadDecisions);
  const [transport] = useState(createAssistantTransport);
  const [initialMessages] = useState(loadAssistantMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useChat({ transport, messages: initialMessages });
  const busy = chat.status === "submitted" || chat.status === "streaming";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authorizedFetch("/assistant/status");
        if (!res.ok || cancelled) return;
        setStatus((await res.json()) as AssistantStatusResponse);
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!busy) saveAssistantMessages(chat.messages);
  }, [busy, chat.messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, open]);

  if (!status?.enabled) return null;

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void chat.sendMessage({ text: trimmed });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onDecision(toolCallId: string, decision: AssistantDecision) {
    const next = { ...decisions, [toolCallId]: decision };
    setDecisions(next);
    saveDecisions(next);
    if (decision.status === "applied") {
      // Local note (no model call) so the next turn knows the change was applied.
      chat.setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: `✅ Diterapkan oleh pengguna: ${decision.message}` }],
        },
      ]);
    }
  }

  function reset() {
    chat.stop();
    chat.setMessages([]);
    chat.clearError();
    setDecisions({});
    saveDecisions({});
    saveAssistantMessages([]);
  }

  const suggestions = suggestionsFor(me.permissions);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-1.5 rounded-xl"
        onClick={() => setOpen(true)}
        aria-label="Buka Asisten"
      >
        <SparkleIcon size={16} weight="fill" className="text-primary" />
        <span className="hidden sm:inline">Asisten</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle className="flex items-center gap-2">
              <SparkleIcon size={18} weight="fill" className="text-primary" />
              Asisten
            </SheetTitle>
            <SheetDescription className="text-xs">
              Tanya data toko atau minta usulan perubahan. Perubahan baru terjadi setelah Anda
              menekan Konfirmasi.
            </SheetDescription>
          </SheetHeader>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {chat.messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Coba tanyakan:</p>
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start rounded-xl px-3 py-2 text-left text-sm whitespace-normal"
                    onClick={() => send(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            ) : (
              chat.messages.map((message) => (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  permissions={me.permissions}
                  decisions={decisions}
                  busy={busy}
                  onDecision={onDecision}
                />
              ))
            )}
            {chat.status === "submitted" ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleNotchIcon size={12} className="animate-spin" /> Berpikir…
              </p>
            ) : null}
            {chat.error ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {assistantErrorText(chat.error)}
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-border p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Tulis pertanyaan…"
              rows={2}
              maxLength={2000}
              className="max-h-40 min-h-12 resize-none"
              aria-label="Pesan untuk Asisten"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={chat.messages.length === 0 && !chat.error}
              >
                <ArrowCounterClockwiseIcon size={14} /> Percakapan baru
              </Button>
              {busy ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void chat.stop()}>
                  <StopIcon size={14} weight="fill" /> Berhenti
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!input.trim()}>
                  <PaperPlaneRightIcon size={14} weight="fill" /> Kirim
                </Button>
              )}
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
