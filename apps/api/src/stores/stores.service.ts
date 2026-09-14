import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { resolveSellingPrice } from "@pos-apps/domain";
import type {
  CreateRegisterRequest,
  CreateStoreRequest,
  RegisterRecord,
  SetStorePriceRequest,
  StoreListResponse,
  StorePrice,
  StoreRecord,
  UpdateStoreRequest,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, registers, storePrices, stores } from "../db/schema";
import {
  CLOUDINARY_ADAPTER,
  type CloudinaryPort,
} from "../media/cloudinary.adapter";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 8 * 1024 * 1024;

function toStore(row: typeof stores.$inferSelect): StoreRecord {
  return {
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    logo_public_id: row.logoPublicId ?? null,
    logo_secure_url: row.logoSecureUrl ?? null,
  };
}

function toRegister(row: typeof registers.$inferSelect): RegisterRecord {
  return {
    register_id: row.registerId,
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

@Injectable()
export class StoresService {
  constructor(
    @Inject(CLOUDINARY_ADAPTER) private readonly cloudinary: CloudinaryPort,
  ) {}

  async list(): Promise<StoreListResponse> {
    const db = getDb();
    const [storeRows, registerRows] = await Promise.all([
      db.select().from(stores).orderBy(asc(stores.createdAt)),
      db.select().from(registers).orderBy(asc(registers.createdAt)),
    ]);
    return {
      stores: storeRows.map(toStore),
      registers: registerRows.map(toRegister),
    };
  }

  async getById(storeId: string): Promise<StoreRecord> {
    const rows = await getDb()
      .select()
      .from(stores)
      .where(eq(stores.storeId, storeId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "STORE_NOT_FOUND",
        message: "Toko tidak ditemukan.",
      });
    }
    return toStore(rows[0]);
  }

  async createStore(input: CreateStoreRequest): Promise<StoreRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama toko wajib diisi.",
      });
    }
    const db = getDb();
    return db.transaction(async (tx) => {
      const [store] = await tx
        .insert(stores)
        .values({ storeId: randomUUID(), name })
        .returning();
      if (!store) {
        throw new BadRequestException({
          code: "STORE_INVALID",
          message: "Gagal membuat toko.",
        });
      }
      await tx.insert(registers).values({
        registerId: randomUUID(),
        storeId: store.storeId,
        name: "Register 1",
      });
      return toStore(store);
    });
  }

  async updateStore(
    storeId: string,
    input: UpdateStoreRequest,
  ): Promise<StoreRecord> {
    await this.requireStoreRow(storeId);
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama toko wajib diisi.",
      });
    }
    const [row] = await getDb()
      .update(stores)
      .set({ name })
      .where(eq(stores.storeId, storeId))
      .returning();
    if (!row) {
      throw new NotFoundException({
        code: "STORE_NOT_FOUND",
        message: "Toko tidak ditemukan.",
      });
    }
    return toStore(row);
  }

  async setLogo(
    storeId: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ): Promise<StoreRecord> {
    const existing = await this.requireStoreRow(storeId);
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

    const uploaded = await this.cloudinary.uploadBuffer(
      file.buffer,
      `pos/stores/${storeId}`,
    );
    const [row] = await getDb()
      .update(stores)
      .set({
        logoPublicId: uploaded.public_id,
        logoSecureUrl: uploaded.secure_url,
      })
      .where(eq(stores.storeId, storeId))
      .returning();
    if (!row) {
      throw new NotFoundException({
        code: "STORE_NOT_FOUND",
        message: "Toko tidak ditemukan.",
      });
    }
    if (
      existing.logoPublicId &&
      existing.logoPublicId !== uploaded.public_id
    ) {
      try {
        await this.cloudinary.destroy(existing.logoPublicId);
      } catch {
        /* previous asset may remain; new logo is already stored */
      }
    }
    return toStore(row);
  }

  async getLogoFile(
    storeId: string,
  ): Promise<{ mimeType: string; bytes: Buffer }> {
    const store = await this.requireStoreRow(storeId);
    if (!store.logoPublicId && !store.logoSecureUrl) {
      throw new NotFoundException({
        code: "STORE_LOGO_NOT_FOUND",
        message: "Logo toko tidak ditemukan.",
      });
    }
    const url =
      this.cloudinary.isConfigured() && store.logoPublicId
        ? this.cloudinary.deliveryUrl(store.logoPublicId)
        : store.logoSecureUrl;
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

  async createRegister(input: CreateRegisterRequest): Promise<RegisterRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama register wajib diisi.",
      });
    }
    await this.requireStore(input.store_id);
    const [row] = await getDb()
      .insert(registers)
      .values({ registerId: randomUUID(), storeId: input.store_id, name })
      .returning();
    if (!row) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Gagal membuat register.",
      });
    }
    return toRegister(row);
  }

  async setPrice(input: SetStorePriceRequest): Promise<StorePrice> {
    await this.requireStore(input.store_id);
    const product = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.productId, input.product_id))
      .limit(1);
    if (!product[0]) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
    const db = getDb();
    if (input.price_minor == null) {
      await db
        .delete(storePrices)
        .where(
          and(
            eq(storePrices.storeId, input.store_id),
            eq(storePrices.productId, input.product_id),
          ),
        );
      return {
        store_id: input.store_id,
        product_id: input.product_id,
        price_minor: null,
      };
    }
    await db
      .insert(storePrices)
      .values({
        storeId: input.store_id,
        productId: input.product_id,
        priceMinor: input.price_minor,
      })
      .onConflictDoUpdate({
        target: [storePrices.storeId, storePrices.productId],
        set: { priceMinor: input.price_minor },
      });
    return {
      store_id: input.store_id,
      product_id: input.product_id,
      price_minor: input.price_minor,
    };
  }

  async pricesForStore(storeId: string): Promise<Map<string, number>> {
    const id = storeId || STORE_1_ID;
    const rows = await getDb()
      .select()
      .from(storePrices)
      .where(eq(storePrices.storeId, id));
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.priceMinor != null) {
        map.set(row.productId, row.priceMinor);
      }
    }
    return map;
  }

  overlayCatalogPrice(catalogPrice: number, storePrice?: number | null): number {
    return resolveSellingPrice({
      catalog_price_minor: catalogPrice,
      store_price_minor: storePrice,
    });
  }

  async requireStore(storeId: string): Promise<string> {
    const row = await this.requireStoreRow(storeId);
    return row.storeId;
  }

  async requireStoreRow(
    storeId: string,
  ): Promise<typeof stores.$inferSelect> {
    const rows = await getDb()
      .select()
      .from(stores)
      .where(eq(stores.storeId, storeId))
      .limit(1);
    if (!rows[0]) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Toko tidak ditemukan.",
      });
    }
    return rows[0];
  }

  async firstRegister(storeId: string): Promise<string> {
    const rows = await getDb()
      .select({ registerId: registers.registerId })
      .from(registers)
      .where(eq(registers.storeId, storeId))
      .orderBy(asc(registers.createdAt))
      .limit(1);
    return rows[0]?.registerId ?? "";
  }
}
