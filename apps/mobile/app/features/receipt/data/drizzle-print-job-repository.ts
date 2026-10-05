import { asc, count, eq, sql } from "drizzle-orm";
import { printJobs } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { PrintJob, PrintJobRepository } from "../domain/print-queue";

export class DrizzlePrintJobRepository implements PrintJobRepository {
  constructor(private readonly db: AppDb) {}

  insert(job: { jobId: string; saleId: string | null; payloadB64: string; createdAt: number }): void {
    this.db.insert(printJobs).values(job).run();
  }

  listPending(): PrintJob[] {
    return this.db
      .select()
      .from(printJobs)
      .where(eq(printJobs.status, "pending"))
      .orderBy(asc(printJobs.createdAt))
      .all()
      .map((r) => ({
        jobId: r.jobId,
        saleId: r.saleId,
        payloadB64: r.payloadB64,
        attempts: r.attempts,
      }));
  }

  markPrinted(jobId: string, at: number): void {
    this.db
      .update(printJobs)
      .set({ status: "printed", printedAt: at, lastError: null })
      .where(eq(printJobs.jobId, jobId))
      .run();
  }

  markAttempt(jobId: string, error: string | null): void {
    this.db
      .update(printJobs)
      .set({ attempts: sql`${printJobs.attempts} + 1`, lastError: error })
      .where(eq(printJobs.jobId, jobId))
      .run();
  }

  pendingCount(): number {
    return (
      this.db
        .select({ n: count() })
        .from(printJobs)
        .where(eq(printJobs.status, "pending"))
        .get()?.n ?? 0
    );
  }
}
