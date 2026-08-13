import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { ProductImage } from "@pos-apps/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  mediaDeleteRetries,
  productImages,
  products,
  type ProductImageRow,
} from "../db/schema";
import {
  CLOUDINARY_ADAPTER,
  type CloudinaryPort,
} from "./cloudinary.adapter";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    @Inject(CLOUDINARY_ADAPTER) private readonly cloudinary: CloudinaryPort,
  ) {}

  async imagesFor(productIds: string[]): Promise<Map<string, ProductImage[]>> {
    const map = new Map<string, ProductImage[]>();
    if (productIds.length === 0) return map;
    const rows = await getDb()
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
    for (const row of rows) {
      const list = map.get(row.productId) ?? [];
      list.push(this.toImage(row));
      map.set(row.productId, list);
    }
    return map;
  }

  async upload(
    productId: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    altText?: string | null,
  ): Promise<ProductImage> {
    await this.requireProduct(productId);
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: "MEDIA_FILE_REQUIRED",
        message: "Berkas gambar wajib diunggah.",
      });
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        code: "MEDIA_INVALID_TYPE",
        message: "Gunakan JPEG, PNG, WebP, atau GIF.",
      });
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException({
        code: "MEDIA_TOO_LARGE",
        message: "Ukuran gambar maksimal 8 MB.",
      });
    }
    if (!this.cloudinary.isConfigured()) {
      throw new ServiceUnavailableException({
        code: "MEDIA_NOT_CONFIGURED",
        message: "Layanan media belum dikonfigurasi.",
      });
    }

    await this.retryPendingDeletes();

    const uploaded = await this.cloudinary.uploadBuffer(
      file.buffer,
      `pos/products/${productId}`,
    );

    const existing = await getDb()
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder));
    const isPrimary = existing.length === 0;
    const sortOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((row) => row.sortOrder)) + 1;

    let row: ProductImageRow;
    try {
      const inserted = await getDb()
        .insert(productImages)
        .values({
          productId,
          publicId: uploaded.public_id,
          secureUrl: uploaded.secure_url,
          width: uploaded.width ?? null,
          height: uploaded.height ?? null,
          format: uploaded.format ?? null,
          bytes: uploaded.bytes ?? null,
          altText: altText?.trim() || null,
          sortOrder,
          isPrimary,
        })
        .returning();
      const created = inserted[0];
      if (!created) {
        throw new Error("insert returned no row");
      }
      row = created;
    } catch (err) {
      try {
        await this.cloudinary.destroy(uploaded.public_id);
      } catch (destroyErr) {
        await this.enqueueRetry(
          uploaded.public_id,
          destroyErr instanceof Error ? destroyErr.message : String(destroyErr),
        );
      }
      throw err;
    }

    return this.toImage(row);
  }

  async reorder(productId: string, imageIds: string[]): Promise<ProductImage[]> {
    await this.requireProduct(productId);
    const rows = await getDb()
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId));
    if (rows.length !== imageIds.length) {
      throw new BadRequestException({
        code: "MEDIA_REORDER_MISMATCH",
        message: "Daftar urutan gambar tidak lengkap.",
      });
    }
    const owned = new Set(rows.map((row) => row.imageId));
    if (imageIds.some((id) => !owned.has(id))) {
      throw new BadRequestException({
        code: "MEDIA_REORDER_MISMATCH",
        message: "Daftar urutan gambar tidak valid.",
      });
    }
    await getDb().transaction(async (tx) => {
      for (const [index, imageId] of imageIds.entries()) {
        await tx
          .update(productImages)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(
            and(
              eq(productImages.imageId, imageId),
              eq(productImages.productId, productId),
            ),
          );
      }
    });
    const map = await this.imagesFor([productId]);
    return map.get(productId) ?? [];
  }

  async updateImage(
    productId: string,
    imageId: string,
    input: { is_primary?: boolean; alt_text?: string | null },
  ): Promise<ProductImage> {
    await this.requireProduct(productId);
    const row = await this.requireImage(productId, imageId);
    if (input.is_primary === true) {
      await getDb().transaction(async (tx) => {
        await tx
          .update(productImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(productImages.productId, productId));
        await tx
          .update(productImages)
          .set({
            isPrimary: true,
            altText:
              input.alt_text !== undefined
                ? input.alt_text?.trim() || null
                : row.altText,
            updatedAt: new Date(),
          })
          .where(eq(productImages.imageId, imageId));
      });
    } else if (input.alt_text !== undefined) {
      await getDb()
        .update(productImages)
        .set({
          altText: input.alt_text?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(productImages.imageId, imageId));
    }
    const fresh = await this.requireImage(productId, imageId);
    return this.toImage(fresh);
  }

  async getFile(
    productId: string,
    imageId: string,
  ): Promise<{ mimeType: string; bytes: Buffer }> {
    const row = await this.requireImage(productId, imageId);
    const url = this.cloudinary.isConfigured()
      ? this.cloudinary.deliveryUrl(row.publicId)
      : row.secureUrl;
    if (!url) {
      throw new ServiceUnavailableException({
        code: "MEDIA_NOT_CONFIGURED",
        message: "Layanan media belum dikonfigurasi.",
      });
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`cdn ${res.status}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) {
        throw new BadRequestException({
          code: "MEDIA_TOO_LARGE",
          message: "Ukuran gambar maksimal 8 MB.",
        });
      }
      const rawType = res.headers.get("content-type") ?? "image/jpeg";
      const mimeType = rawType.split(";")[0]?.trim() || "image/jpeg";
      return { mimeType, bytes };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadGatewayException({
        code: "MEDIA_UNAVAILABLE",
        message: "Gambar tidak dapat diambil.",
      });
    }
  }

  async remove(productId: string, imageId: string): Promise<void> {
    await this.requireProduct(productId);
    const row = await this.requireImage(productId, imageId);
    await getDb()
      .delete(productImages)
      .where(eq(productImages.imageId, imageId));

    if (row.isPrimary) {
      const [next] = await getDb()
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(asc(productImages.sortOrder))
        .limit(1);
      if (next) {
        await getDb()
          .update(productImages)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(productImages.imageId, next.imageId));
      }
    }

    try {
      if (this.cloudinary.isConfigured()) {
        await this.cloudinary.destroy(row.publicId);
      } else {
        await this.enqueueRetry(row.publicId, "MEDIA_NOT_CONFIGURED");
      }
    } catch (err) {
      await this.enqueueRetry(
        row.publicId,
        err instanceof Error ? err.message : String(err),
      );
    }
    await this.retryPendingDeletes();
  }

  async retryPendingDeletes(): Promise<void> {
    if (!this.cloudinary.isConfigured()) return;
    const pending = await getDb().select().from(mediaDeleteRetries);
    for (const item of pending) {
      try {
        await this.cloudinary.destroy(item.publicId);
        await getDb()
          .delete(mediaDeleteRetries)
          .where(eq(mediaDeleteRetries.retryId, item.retryId));
      } catch (err) {
        await getDb()
          .update(mediaDeleteRetries)
          .set({
            attempts: item.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(mediaDeleteRetries.retryId, item.retryId));
      }
    }
  }

  private async enqueueRetry(publicId: string, lastError: string): Promise<void> {
    await getDb().insert(mediaDeleteRetries).values({
      publicId,
      attempts: 1,
      lastError,
    });
  }

  private toImage(row: ProductImageRow): ProductImage {
    return {
      image_id: row.imageId,
      product_id: row.productId,
      public_id: row.publicId,
      secure_url: this.cloudinary.isConfigured()
        ? this.cloudinary.deliveryUrl(row.publicId)
        : row.secureUrl,
      width: row.width,
      height: row.height,
      format: row.format,
      bytes: row.bytes,
      alt_text: row.altText,
      sort_order: row.sortOrder,
      is_primary: row.isPrimary,
    };
  }

  private async requireProduct(productId: string): Promise<void> {
    const rows = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
  }

  private async requireImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageRow> {
    const rows = await getDb()
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.imageId, imageId),
          eq(productImages.productId, productId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "MEDIA_NOT_FOUND",
        message: "Gambar tidak ditemukan.",
      });
    }
    return row;
  }
}
