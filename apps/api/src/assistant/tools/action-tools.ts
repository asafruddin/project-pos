import { normalizePromotion } from "@pos-apps/domain";
import type {
  AssistantActionChange,
  AssistantActionProposal,
  UpsertPromotionRequest,
} from "@pos-apps/types";
import { z } from "zod";
import { actorStoreId } from "../../auth/store-scope";
import type { AssistantProduct } from "../product-lookup";
import { formatIdr } from "./format";
import { can, safely } from "./read-tools";
import type { AssistantDeps, AssistantTools, AssistantViewer } from "./types";

const MAX_INT = 2_147_483_647;
const productId = z.string().uuid().describe("product_id dari search_products");

const STATUS_LABEL = { active: "Aktif", inactive: "Nonaktif" } as const;

type ToolError = { error: string };

/**
 * `propose_*` tools only build a preview. Nothing is written here: the Dashboard
 * applies a proposal through the existing REST endpoint after the user confirms.
 */
export function actionToolsFor(
  viewer: AssistantViewer,
  deps: AssistantDeps,
): AssistantTools {
  const storeId = actorStoreId(viewer);
  const tools: AssistantTools = {};

  async function loadProduct(id: string): Promise<AssistantProduct | ToolError> {
    const product = await deps.products.get(storeId, id);
    return product ?? { error: "Produk tidak ditemukan di toko ini." };
  }

  if (can(viewer, "products", "update")) {
    tools.propose_update_price = safely({
      description:
        "Usulkan perubahan harga jual satu produk. Tidak mengubah data; pengguna harus menekan Konfirmasi.",
      inputSchema: z.object({
        product_id: productId,
        price_minor: z.number().int().min(0).max(MAX_INT).describe("Harga baru dalam rupiah penuh"),
      }),
      execute: async ({ product_id, price_minor }): Promise<AssistantActionProposal | ToolError> => {
        const product = await loadProduct(product_id);
        if ("error" in product) return product;
        if (product.price_minor === price_minor) {
          return { error: `Harga ${product.name} sudah ${formatIdr(price_minor)}.` };
        }
        return {
          kind: "update_price",
          title: `Ubah harga ${product.name}`,
          product_id,
          product_name: product.name,
          changes: [
            {
              field: "Harga",
              from: formatIdr(product.price_minor),
              to: formatIdr(price_minor),
            },
          ],
          payload: { price_minor },
        };
      },
    });

    tools.propose_set_product_status = safely({
      description:
        "Usulkan mengaktifkan atau menonaktifkan produk (produk nonaktif tidak tampil di menu kasir). Tidak mengubah data; pengguna harus menekan Konfirmasi.",
      inputSchema: z.object({
        product_id: productId,
        status: z.enum(["active", "inactive"]),
      }),
      execute: async ({ product_id, status }): Promise<AssistantActionProposal | ToolError> => {
        const product = await loadProduct(product_id);
        if ("error" in product) return product;
        if (product.status === status) {
          return { error: `${product.name} sudah ${STATUS_LABEL[status]}.` };
        }
        return {
          kind: "set_product_status",
          title: `${status === "active" ? "Aktifkan" : "Nonaktifkan"} ${product.name}`,
          product_id,
          product_name: product.name,
          changes: [
            {
              field: "Status",
              from: STATUS_LABEL[product.status],
              to: STATUS_LABEL[status],
            },
          ],
          payload: { status },
        };
      },
    });
  }

  if (can(viewer, "inventory", "update")) {
    tools.propose_adjust_stock = safely({
      description:
        "Usulkan penyesuaian stok (set jumlah stok dapat dijual menjadi angka baru) dengan alasan. Tidak mengubah data; pengguna harus menekan Konfirmasi.",
      inputSchema: z.object({
        product_id: productId,
        stock_qty: z.number().int().min(0).max(MAX_INT).describe("Jumlah stok baru (absolut)"),
        reason: z.string().trim().min(3).max(200).describe("Alasan penyesuaian"),
      }),
      execute: async ({ product_id, stock_qty, reason }): Promise<AssistantActionProposal | ToolError> => {
        const product = await loadProduct(product_id);
        if ("error" in product) return product;
        if (!product.track_stock) {
          return { error: `${product.name} tidak melacak stok.` };
        }
        return {
          kind: "adjust_stock",
          title: `Sesuaikan stok ${product.name}`,
          product_id,
          product_name: product.name,
          changes: [
            { field: "Stok", from: String(product.stock_qty), to: String(stock_qty) },
            { field: "Alasan", from: null, to: reason },
          ],
          payload: { stock_qty, reason },
        };
      },
    });
  }

  if (can(viewer, "promotions", "create")) {
    tools.propose_create_promotion = safely({
      description:
        "Usulkan promo otomatis baru (diskon persen atau nominal), opsional untuk produk tertentu, kode kupon, minimal belanja, periode tanggal, dan jam. Tidak mengubah data; pengguna harus menekan Konfirmasi.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(100),
        kind: z.enum(["percent", "fixed"]),
        percent: z.number().min(0.01).max(100).optional().describe("Diskon persen (kind=percent), mis. 10 untuk 10%"),
        fixed_minor: z.number().int().min(1).max(MAX_INT).optional().describe("Potongan rupiah (kind=fixed)"),
        product_ids: z.array(productId).max(20).optional().describe("Kosongkan untuk semua produk"),
        coupon_code: z.string().trim().max(40).optional(),
        min_subtotal_minor: z.number().int().min(0).max(MAX_INT).optional(),
        starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Tanggal mulai YYYY-MM-DD"),
        ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Tanggal selesai YYYY-MM-DD (inklusif)"),
        hour_start: z.number().int().min(0).max(23).optional(),
        hour_end: z.number().int().min(0).max(23).optional(),
      }),
      execute: async (input): Promise<AssistantActionProposal | ToolError> => {
        if ((input.hour_start == null) !== (input.hour_end == null)) {
          return { error: "Isi jam mulai dan jam selesai sekaligus, atau kosongkan keduanya." };
        }
        const names: string[] = [];
        for (const id of input.product_ids ?? []) {
          const product = await loadProduct(id);
          if ("error" in product) return product;
          names.push(product.name);
        }
        const payload: UpsertPromotionRequest = {
          name: input.name,
          enabled: true,
          kind: input.kind,
          percent_bps:
            input.kind === "percent" && input.percent != null
              ? Math.round(input.percent * 100)
              : null,
          fixed_minor: input.kind === "fixed" ? (input.fixed_minor ?? null) : null,
          coupon_code: input.coupon_code || null,
          min_subtotal_minor: input.min_subtotal_minor ?? null,
          product_ids: input.product_ids ?? [],
          starts_at: input.starts_on ? `${input.starts_on}T00:00:00.000Z` : null,
          ends_at: input.ends_on ? `${input.ends_on}T23:59:59.999Z` : null,
          hour_start: input.hour_start ?? null,
          hour_end: input.hour_end ?? null,
        };
        if (!normalizePromotion({ promotion_id: "preview", ...payload })) {
          return {
            error:
              "Aturan promo tidak valid. Pastikan persen (1–100) atau nominal potongan diisi sesuai jenisnya.",
          };
        }
        const changes: AssistantActionChange[] = [
          { field: "Nama", from: null, to: payload.name },
          {
            field: "Diskon",
            from: null,
            to:
              payload.kind === "percent"
                ? `${(payload.percent_bps ?? 0) / 100}%`
                : formatIdr(payload.fixed_minor),
          },
          {
            field: "Produk",
            from: null,
            to: names.length ? names.join(", ") : "Semua produk",
          },
        ];
        if (payload.coupon_code) {
          changes.push({ field: "Kode kupon", from: null, to: payload.coupon_code.toUpperCase() });
        }
        if (payload.min_subtotal_minor != null) {
          changes.push({ field: "Minimal belanja", from: null, to: formatIdr(payload.min_subtotal_minor) });
        }
        if (input.starts_on || input.ends_on) {
          changes.push({
            field: "Periode",
            from: null,
            to: `${input.starts_on ?? "sekarang"} s/d ${input.ends_on ?? "tanpa batas"}`,
          });
        }
        if (payload.hour_start != null && payload.hour_end != null) {
          changes.push({
            field: "Jam",
            from: null,
            to: `${payload.hour_start}:00–${payload.hour_end}:59`,
          });
        }
        return {
          kind: "create_promotion",
          title: `Buat promo ${payload.name}`,
          changes,
          payload,
        };
      },
    });
  }

  return tools;
}
