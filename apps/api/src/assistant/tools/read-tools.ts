import { HttpException } from "@nestjs/common";
import { grantsFor, hasPermission } from "@pos-apps/domain";
import { z } from "zod";
import { actorStoreId } from "../../auth/store-scope";
import { formatIdr } from "./format";
import type {
  AssistantDeps,
  AssistantTool,
  AssistantTools,
  AssistantViewer,
} from "./types";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Tanggal UTC format YYYY-MM-DD");

const range = z.object({
  from: isoDate.describe("Tanggal awal (UTC, YYYY-MM-DD), inklusif"),
  to: isoDate.describe("Tanggal akhir (UTC, YYYY-MM-DD), inklusif"),
});

/** Service errors become a tool result the model can explain instead of a failed stream. */
export function toolErrorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === "object" && body && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
    return err.message;
  }
  return "Data tidak dapat dimuat.";
}

export function safely<I, O>(
  tool: AssistantTool<I, O>,
): AssistantTool<I, O | { error: string }> {
  return {
    ...tool,
    execute: async (input) => {
      try {
        return await tool.execute(input);
      } catch (err) {
        return { error: toolErrorMessage(err) };
      }
    },
  };
}

export function can(viewer: AssistantViewer, resource: string, action: string): boolean {
  return hasPermission(grantsFor(viewer), resource, action);
}

/** Read-only tools. Each is registered only when the viewer holds its grant. */
export function readToolsFor(
  viewer: AssistantViewer,
  deps: AssistantDeps,
): AssistantTools {
  const storeId = actorStoreId(viewer);
  const tools: AssistantTools = {};

  if (can(viewer, "reports", "view")) {
    tools.get_sales_summary = safely({
      description:
        "Ringkasan penjualan toko untuk rentang tanggal: pendapatan, jumlah transaksi, unit, rata-rata transaksi, diskon, refund, bersih (dan laba kotor bila akun berhak).",
      inputSchema: range,
      execute: async ({ from, to }) => {
        const s = await deps.reports.summary({ from, to }, viewer);
        return {
          ...s,
          revenue_formatted: formatIdr(s.revenue_minor),
          aov_formatted: formatIdr(s.aov_minor),
          discount_formatted: formatIdr(s.discount_minor),
          refund_formatted: formatIdr(s.refund_minor),
          net_formatted: formatIdr(s.net_minor),
          ...(s.gross_profit_minor != null
            ? { gross_profit_formatted: formatIdr(s.gross_profit_minor) }
            : {}),
        };
      },
    });

    tools.get_product_ranking = safely({
      description:
        "Peringkat produk berdasarkan unit terjual dalam rentang tanggal. order=top untuk terlaris, order=slow untuk paling sedikit terjual (hanya produk yang terjual minimal sekali; produk tanpa penjualan ada di get_inventory_insights.dead_stock). Maksimal 10 baris.",
      inputSchema: range.extend({
        order: z.enum(["top", "slow"]).default("top"),
        limit: z.number().int().min(1).max(10).default(10),
      }),
      execute: async ({ from, to, order, limit }) => {
        const res = await deps.reports.products({ from, to }, viewer);
        const rows = (order === "slow" ? res.slow : res.top).slice(0, limit);
        return {
          from: res.from,
          to: res.to,
          order,
          products: rows.map((row) => ({
            ...row,
            revenue_formatted: formatIdr(row.revenue_minor),
            ...(row.margin_minor != null
              ? { margin_formatted: formatIdr(row.margin_minor) }
              : {}),
          })),
        };
      },
    });

    tools.get_cashier_performance = safely({
      description:
        "Omzet, jumlah transaksi, dan refund per kasir/shift dalam rentang tanggal. Akun tanpa akses keuangan hanya melihat datanya sendiri.",
      inputSchema: range,
      execute: async ({ from, to }) => {
        const res = await deps.reports.cashiers({ from, to }, viewer);
        return {
          from: res.from,
          to: res.to,
          cashiers: res.cashiers
            .sort((a, b) => b.revenue_minor - a.revenue_minor)
            .slice(0, 20)
            .map((row) => ({
              cashier: row.cashier_username ?? "Tidak diketahui",
              shift_id: row.shift_id,
              revenue_minor: row.revenue_minor,
              revenue_formatted: formatIdr(row.revenue_minor),
              txn_count: row.txn_count,
              refund_formatted: formatIdr(row.refund_minor),
            })),
        };
      },
    });
  }

  if (can(viewer, "reports", "view_financial")) {
    tools.get_inventory_insights = safely({
      description:
        "Nilai stok (harga modal), stok mati (ada stok tapi tidak terjual dalam rentang), dan pergerakan stok per alasan dalam rentang tanggal.",
      inputSchema: range,
      execute: async ({ from, to }) => {
        const res = await deps.reports.inventory({ from, to }, viewer);
        return {
          from: res.from,
          to: res.to,
          stock_value_minor: res.stock_value_minor,
          stock_value_formatted: formatIdr(res.stock_value_minor),
          dead_stock: res.dead_stock.slice(0, 20),
          dead_stock_count: res.dead_stock.length,
          movements: res.movements,
        };
      },
    });
  }

  if (can(viewer, "inventory", "view")) {
    tools.get_stock_levels = safely({
      description:
        "Stok saat ini per produk (dapat dijual, rusak, dalam transit) dari buku besar stok. low_only=true untuk produk yang habis atau di bawah stok minimum.",
      inputSchema: z.object({
        query: z.string().max(100).optional().describe("Filter nama atau SKU"),
        low_only: z.boolean().default(false),
      }),
      execute: async ({ query, low_only }) => {
        const res = await deps.inventory.overview(storeId);
        const term = query?.trim().toLowerCase();
        const rows = res.products
          .filter((p) => !low_only || p.is_low || p.is_out)
          .filter(
            (p) =>
              !term ||
              p.name.toLowerCase().includes(term) ||
              (p.sku ?? "").toLowerCase().includes(term),
          )
          .sort((a, b) => a.sellable_qty - b.sellable_qty);
        return {
          total_matches: rows.length,
          products: rows.slice(0, 30).map((p) => ({
            product_id: p.product_id,
            name: p.name,
            sku: p.sku,
            sellable_qty: p.sellable_qty,
            damaged_qty: p.damaged_qty,
            min_qty: p.min_qty,
            is_low: p.is_low,
            is_out: p.is_out,
          })),
        };
      },
    });
  }

  if (can(viewer, "products", "view")) {
    tools.search_products = safely({
      description:
        "Cari produk katalog berdasarkan nama atau SKU. Gunakan untuk mendapatkan product_id sebelum mengusulkan perubahan.",
      inputSchema: z.object({
        query: z.string().min(1).max(100),
      }),
      execute: async ({ query }) => {
        const rows = await deps.products.search(storeId, query, 10);
        return {
          products: rows.map((p) => ({
            ...p,
            price_formatted: formatIdr(p.price_minor),
          })),
        };
      },
    });
  }

  if (can(viewer, "customers", "view")) {
    tools.search_customers = safely({
      description:
        "Cari pelanggan berdasarkan nama, telepon, atau email. Mengembalikan nama, grup, poin loyalti, dan saldo kredit (tanpa kontak).",
      inputSchema: z.object({
        query: z.string().min(1).max(100),
      }),
      execute: async ({ query }) => {
        const res = await deps.customers.list(query, storeId);
        return {
          total_matches: res.customers.length,
          customers: res.customers.slice(0, 10).map((c) => ({
            customer_id: c.customer_id,
            name: c.name,
            group_name: c.group_name,
            loyalty_points: c.loyalty_points,
            loyalty_tier: c.loyalty_tier,
            store_credit_formatted: formatIdr(c.store_credit_minor),
          })),
        };
      },
    });
  }

  return tools;
}
