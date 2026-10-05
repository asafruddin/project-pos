import { postVoid } from "@pos-apps/domain";
import { AppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { PinService } from "@/features/pin/domain/pin-service";
import type { SalesRepository } from "./ports";
import type { CompletedSale } from "./sale";

export type VoidAuth = "unattended" | "enroll" | "unlock";

export type VoidErrorCode = "VOID_NOT_FOUND" | "VOID_NOT_ALLOWED" | "VOID_INVALID" | "VOID_PIN_SAME" | "VOID_PIN_WRONG" | "VOID_PIN_LOCKED" | "VOID_PIN_REQUIRED";

function sameLocalDay(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Number.isFinite(t) && t >= start && t < start + 86_400_000;
}

/** Same-day void of a completed sale. Needs `sales:void_unattended` or a manager PIN. */
export class VoidSaleUseCase {
  constructor(
    private readonly sales: SalesRepository,
    private readonly pins: PinService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly permissions: () => string[],
    private readonly userId: () => string | null,
    private readonly onQueued: () => void,
  ) {}

  /** How the cashier must authorise a void on this device. */
  async authMode(): Promise<VoidAuth> {
    if (this.permissions().includes("sales:void_unattended")) return "unattended";
    return (await this.pins.hasManagerPin()) ? "unlock" : "enroll";
  }

  async execute(saleId: string, managerPin?: string): Promise<CompletedSale> {
    const sale = this.sales.getSale(saleId);
    if (!sale) throw new AppError("VALIDATION", "VOID_NOT_FOUND");
    const now = new Date(this.clock.nowMs());
    const verdict = postVoid({
      sale_status: "complete",
      already_voided: Boolean(sale.voidedAt),
      already_returned: false,
      same_calendar_day: sameLocalDay(sale.completedAt, now),
      lines: sale.lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
    });
    if (!verdict.ok) throw new AppError("VALIDATION", verdict.code);

    await this.authorise(managerPin);

    const voided = this.sales.voidSale({ saleId, voidId: this.ids.uuid(), voidedAt: this.clock.nowIso() });
    this.onQueued();
    return voided;
  }

  private async authorise(pin: string | undefined): Promise<void> {
    const mode = await this.authMode();
    if (mode === "unattended") return;
    if (!pin || !/^\d{6}$/.test(pin)) throw new AppError("VALIDATION", "VOID_PIN_REQUIRED");
    if (mode === "enroll") {
      // The manager PIN must differ from the cashier's own PIN, or it protects nothing.
      const uid = this.userId();
      if (uid && (await this.pins.verify(uid, pin)).ok) throw new AppError("VALIDATION", "VOID_PIN_SAME");
      await this.pins.enrollManager(pin);
      return;
    }
    const result = await this.pins.verifyManager(pin);
    if (!result.ok) throw new AppError("VALIDATION", result.reason === "locked" ? "VOID_PIN_LOCKED" : "VOID_PIN_WRONG");
  }
}
