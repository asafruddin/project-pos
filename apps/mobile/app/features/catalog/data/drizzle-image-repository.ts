import { eq, notInArray } from "drizzle-orm";
import { catalogImages } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { ImageRepository } from "../domain/ports";

export class DrizzleImageRepository implements ImageRepository {
  constructor(private readonly db: AppDb) {}

  uriMap(): Map<string, string> {
    return new Map(this.db.select().from(catalogImages).all().map((r) => [r.productId, r.fileUri]));
  }

  get(productId: string): { imageId: string; fileUri: string } | null {
    const row = this.db.select().from(catalogImages).where(eq(catalogImages.productId, productId)).get();
    return row ? { imageId: row.imageId, fileUri: row.fileUri } : null;
  }

  put(row: { productId: string; imageId: string; fileUri: string; cachedAt: string }): void {
    this.db
      .insert(catalogImages)
      .values(row)
      .onConflictDoUpdate({ target: catalogImages.productId, set: { imageId: row.imageId, fileUri: row.fileUri, cachedAt: row.cachedAt } })
      .run();
  }

  prune(keep: Set<string>): string[] {
    const ids = [...keep];
    const stale = this.db
      .select()
      .from(catalogImages)
      .where(ids.length ? notInArray(catalogImages.productId, ids) : undefined)
      .all();
    for (const row of stale) this.db.delete(catalogImages).where(eq(catalogImages.productId, row.productId)).run();
    return stale.map((r) => r.fileUri);
  }
}
