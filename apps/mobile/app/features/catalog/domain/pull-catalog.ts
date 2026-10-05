import type { Clock } from "@/core/ports/clock";
import type { FileStore } from "@/core/ports/files";
import type { PullTask } from "@/infrastructure/sync/pull-task";
import type { CatalogRemote, CatalogRepository, ImageRepository } from "./ports";

const IMAGE_CONCURRENCY = 4;

/**
 * Full catalog refresh into the local database, then product photos into the file cache.
 * Images never block selling: failures are skipped and retried on the next pull.
 */
export class PullCatalogTask implements PullTask {
  readonly name = "catalog";
  readonly minIntervalMs = 10 * 60_000;

  constructor(
    private readonly remote: CatalogRemote,
    private readonly repo: CatalogRepository,
    private readonly images: ImageRepository,
    private readonly files: FileStore,
    private readonly clock: Clock,
    private readonly onPulled?: () => void,
  ) {}

  async run(): Promise<void> {
    const { products, images } = await this.remote.fetchAll();
    this.repo.replaceAll(products, this.clock.nowIso());
    this.onPulled?.();

    for (const uri of this.images.prune(new Set(images.map((i) => i.productId)))) this.files.remove(uri);

    const queue = images.filter((img) => this.images.get(img.productId)?.imageId !== img.imageId);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const img = queue[cursor++];
        const uri = await this.files.download({
          path: `/catalog/products/${img.productId}/images/${img.imageId}/file`,
          name: `product-${img.productId}-${img.imageId}`,
          timeoutMs: 8000,
        });
        if (uri) this.images.put({ ...img, fileUri: uri, cachedAt: this.clock.nowIso() });
      }
    };
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, queue.length) }, worker));
    if (queue.length > 0) this.onPulled?.();
  }
}
