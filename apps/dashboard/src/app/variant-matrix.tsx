"use client";

import { Button, Input } from "@pos-apps/ui/atoms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos-apps/ui/molecules";
import { FormSection } from "@pos-apps/ui/organisms";
import Link from "next/link";
import { Fragment, useState } from "react";
import type { Product, VariantGroupRecord } from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { formatIdr } from "@/lib/format-money";

export const MAX_VARIANT_AXES = 3;
const INT32_MAX = 2_147_483_647;
const SEP = "\u0001";

export type VariantAxis = { name: string; values: string[] };

export type VariantRowDraft = {
  price: string;
  cost: string;
  stock: string;
  sku: string;
  barcode: string;
  compareAt: string;
  minQty: string;
  maxQty: string;
  active: boolean;
};

export type VariantDraft = {
  enabled: boolean;
  axes: VariantAxis[];
  /** Keyed by `comboKey(values)`; rows of removed combinations are kept so re-adding restores them. */
  rows: Record<string, VariantRowDraft>;
  /** Single-price values from before variants were switched on; copied to the first combination. */
  seed: VariantRowDraft | null;
};

export const emptyRow: VariantRowDraft = {
  price: "",
  cost: "",
  stock: "",
  sku: "",
  barcode: "",
  compareAt: "",
  minQty: "",
  maxQty: "",
  active: true,
};

export const emptyVariantDraft: VariantDraft = {
  enabled: false,
  axes: [],
  rows: {},
  seed: null,
};

export function comboKey(values: string[]): string {
  return values.map((v) => v.trim().toLowerCase()).join(SEP);
}

export function comboLabel(values: string[]): string {
  return values.join(" / ");
}

/** Cartesian product of axis values, in axis order. Axes without values are ignored. */
export function combos(axes: VariantAxis[]): string[][] {
  const usable = axes.filter((a) => a.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<string[][]>(
    (acc, axis) => acc.flatMap((prefix) => axis.values.map((v) => [...prefix, v])),
    [[]],
  );
}

function parseInt32(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isInteger(n) && n <= INT32_MAX ? n : null;
}

function parseSignedInt32(raw: string): number | null {
  const negative = raw.trim().startsWith("-");
  const n = parseInt32(raw);
  return n === null ? null : negative ? -n : n;
}

function valuesOf(child: Product): string[] {
  if (child.variant_values?.length) return child.variant_values;
  return child.variant_label ? [child.variant_label] : [];
}

function rowFromProduct(child: Product): VariantRowDraft {
  return {
    price: String(child.price_minor),
    cost: child.cost_minor == null ? "" : String(child.cost_minor),
    stock: String(child.stock_qty),
    sku: child.sku ?? "",
    barcode: child.barcode ?? "",
    compareAt: child.compare_at_minor == null ? "" : String(child.compare_at_minor),
    minQty: child.min_qty == null ? "" : String(child.min_qty),
    maxQty: child.max_qty == null ? "" : String(child.max_qty),
    active: child.status === "active",
  };
}

/** Rebuild the editable draft from a saved parent and its child products. */
export function draftFromProducts(parent: Product, children: Product[]): VariantDraft {
  const names = parent.variant_groups ?? [];
  if (names.length === 0 && children.length === 0) return emptyVariantDraft;
  const axes: VariantAxis[] = names.map((name) => ({ name, values: [] }));
  const rows: Record<string, VariantRowDraft> = {};
  for (const child of children) {
    const values = valuesOf(child);
    values.forEach((value, i) => {
      const axis = axes[i];
      if (axis && !axis.values.some((v) => v.toLowerCase() === value.toLowerCase())) {
        axis.values.push(value);
      }
    });
    rows[comboKey(values)] = rowFromProduct(child);
  }
  return { enabled: true, axes, rows, seed: null };
}

/** Make sure every current combination has a row; the first new one inherits `seed`. */
export function syncRows(draft: VariantDraft): VariantDraft {
  let rows = draft.rows;
  let seed = draft.seed;
  for (const values of combos(draft.axes)) {
    const key = comboKey(values);
    if (rows[key]) continue;
    rows = { ...rows, [key]: seed ? { ...seed } : { ...emptyRow } };
    seed = null;
  }
  return rows === draft.rows && seed === draft.seed ? draft : { ...draft, rows, seed };
}

export function activeRows(draft: VariantDraft): Array<{ values: string[]; row: VariantRowDraft }> {
  return combos(draft.axes)
    .map((values) => ({ values, row: draft.rows[comboKey(values)] ?? emptyRow }))
    .filter(({ row }) => row.active);
}

export function priceSummary(draft: VariantDraft): {
  min: number | null;
  max: number | null;
  total: number;
  missing: number;
} {
  const rows = activeRows(draft);
  const prices = rows
    .map(({ row }) => parseInt32(row.price))
    .filter((n): n is number => n !== null);
  return {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    total: rows.length,
    missing: rows.length - prices.length,
  };
}

export function stockTotal(draft: VariantDraft): number {
  return activeRows(draft).reduce((n, { row }) => n + (parseSignedInt32(row.stock) ?? 0), 0);
}

/** First problem that blocks saving, with the offending row key (if any). */
export function validateDraft(draft: VariantDraft): { message: string; key?: string } | null {
  if (draft.axes.length === 0) return { message: "Tambahkan minimal satu jenis varian." };
  for (const axis of draft.axes) {
    if (!axis.name) return { message: "Pilih jenis varian untuk setiap baris." };
    if (axis.values.length === 0) {
      return { message: `Isi minimal satu pilihan untuk ${axis.name}.` };
    }
  }
  const rows = activeRows(draft);
  if (rows.length === 0) return { message: "Aktifkan minimal satu varian." };
  for (const { values, row } of rows) {
    if (parseInt32(row.price) === null) {
      return {
        message: `Lengkapi harga jual ${comboLabel(values)} sebelum menyimpan.`,
        key: comboKey(values),
      };
    }
  }
  return null;
}

type SaveContext = {
  parent: Product;
  draft: VariantDraft;
  groups: VariantGroupRecord[];
  children: Product[];
  trackStock: boolean;
  shared: { category_name: string | null; brand_name: string | null; unit_name: string | null };
};

/**
 * Persist option values typed inline, then create/update/deactivate child products so they
 * match the draft. Returns an error message, or null on success. Stops at the first failure.
 */
export async function saveVariantRows(ctx: SaveContext): Promise<string | null> {
  const { parent, draft, groups, children, trackStock, shared } = ctx;

  for (const axis of draft.axes) {
    const group = groups.find((g) => g.name === axis.name);
    if (!group) continue;
    const known = new Set(group.options.map((o) => o.toLowerCase()));
    const missing = axis.values.filter((v) => !known.has(v.toLowerCase()));
    if (missing.length === 0) continue;
    const res = await catalogRequest<VariantGroupRecord>(
      `/catalog/variants/${group.variant_group_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: group.name, options: [...group.options, ...missing] }),
      },
    );
    if (!res.ok) return res.message;
  }

  const byKey = new Map(children.map((c) => [comboKey(valuesOf(c)), c]));
  const wanted = new Set<string>();

  for (const values of combos(draft.axes)) {
    const key = comboKey(values);
    const row = draft.rows[key] ?? emptyRow;
    const label = comboLabel(values);
    const existing = byKey.get(key);
    const price = parseInt32(row.price);
    if (price === null) {
      if (!row.active) continue;
      return `Harga jual ${label} tidak valid.`;
    }
    wanted.add(key);
    const fields = {
      name: `${parent.name} - ${label}`,
      variant_label: label,
      variant_values: values,
      price_minor: price,
      cost_minor: row.cost.trim() ? parseInt32(row.cost) : null,
      compare_at_minor: row.compareAt.trim() ? parseInt32(row.compareAt) : null,
      min_qty: trackStock && row.minQty.trim() ? parseSignedInt32(row.minQty) : null,
      max_qty: trackStock && row.maxQty.trim() ? parseSignedInt32(row.maxQty) : null,
      sku: row.sku.trim() || null,
      barcode: row.barcode.trim() || null,
      status: row.active ? "active" : "inactive",
      track_stock: trackStock,
    };
    const stock = trackStock ? (parseSignedInt32(row.stock) ?? 0) : 0;

    if (existing) {
      const updated = await catalogRequest<Product>(`/catalog/products/${existing.product_id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      if (!updated.ok) return `${label}: ${updated.message}`;
      if (trackStock && stock !== existing.stock_qty) {
        if (stock < 0) return `${label}: stok harus ≥ 0.`;
        const stocked = await catalogRequest<Product>(
          `/catalog/products/${existing.product_id}/stock`,
          {
            method: "PUT",
            body: JSON.stringify({ stock_qty: stock, reason: "Diubah dari form varian" }),
          },
        );
        if (!stocked.ok) return `${label}: ${stocked.message}`;
      }
    } else {
      if (!row.active) continue;
      if (stock < 0) return `${label}: stok awal harus ≥ 0.`;
      const created = await catalogRequest<Product>("/catalog/products", {
        method: "POST",
        body: JSON.stringify({
          ...fields,
          ...shared,
          stock_qty: stock,
          parent_id: parent.product_id,
        }),
      });
      if (!created.ok) return `${label}: ${created.message}`;
    }
  }

  // Combinations removed from the table keep their history: hide them instead of deleting.
  for (const child of children) {
    if (wanted.has(comboKey(valuesOf(child))) || child.status === "inactive") continue;
    const hidden = await catalogRequest<Product>(`/catalog/products/${child.product_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "inactive" }),
    });
    if (!hidden.ok) return `${child.variant_label ?? child.name}: ${hidden.message}`;
  }
  return null;
}

function Chip({ label, onRemove, disabled }: { label: string; onRemove: () => void; disabled: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
      {label}
      <button
        type="button"
        aria-label={`Hapus ${label}`}
        disabled={disabled}
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </span>
  );
}

function AxisEditor({
  axis,
  groups,
  takenNames,
  disabled,
  onChange,
  onRemove,
}: {
  axis: VariantAxis;
  groups: VariantGroupRecord[];
  takenNames: string[];
  disabled: boolean;
  onChange: (next: VariantAxis) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState("");

  function addValue() {
    const value = text.trim();
    setText("");
    if (!value || axis.values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange({ ...axis, values: [...axis.values, value] });
  }

  const choices = groups.filter((g) => g.name === axis.name || !takenNames.includes(g.name));

  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 max-sm:grid-cols-1">
      <Select
        value={axis.name}
        disabled={disabled}
        onValueChange={(name) => {
          const group = groups.find((g) => g.name === name);
          onChange({ name, values: group ? [...group.options] : [] });
        }}
      >
        <SelectTrigger aria-label="Jenis varian">
          <SelectValue placeholder="Pilih jenis" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((g) => (
            <SelectItem key={g.variant_group_id} value={g.name}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap items-center gap-2">
        {axis.values.map((value) => (
          <Chip
            key={value}
            label={value}
            disabled={disabled}
            onRemove={() =>
              onChange({ ...axis, values: axis.values.filter((v) => v !== value) })
            }
          />
        ))}
        <input
          aria-label={`Tambah pilihan ${axis.name}`}
          placeholder="+ Tambah pilihan"
          value={text}
          disabled={disabled || !axis.name}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addValue();
            }
          }}
          onBlur={addValue}
          className="min-w-32 flex-1 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-sm outline-none focus:border-primary"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" aria-label="Hapus jenis varian" disabled={disabled} onClick={onRemove}>
        Hapus
      </Button>
    </div>
  );
}

export function VariantMatrix({
  draft,
  onChange,
  groups,
  trackStock,
  disabled,
  lockEnabled,
  errorKey,
}: {
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
  groups: VariantGroupRecord[];
  trackStock: boolean;
  disabled: boolean;
  /** Existing variants are saved, so the switch cannot be turned off. */
  lockEnabled: boolean;
  errorKey: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState({ price: "", cost: "", stock: "" });
  const list = combos(draft.axes);
  const takenNames = draft.axes.map((a) => a.name).filter(Boolean);
  const canAddAxis =
    draft.axes.length < MAX_VARIANT_AXES && groups.some((g) => !takenNames.includes(g.name));

  function update(next: VariantDraft) {
    onChange(syncRows(next));
  }

  function patchRow(key: string, patch: Partial<VariantRowDraft>) {
    onChange({
      ...draft,
      rows: { ...draft.rows, [key]: { ...(draft.rows[key] ?? emptyRow), ...patch } },
    });
  }

  function applyAll() {
    const rows = { ...draft.rows };
    for (const values of list) {
      const key = comboKey(values);
      const current = rows[key] ?? emptyRow;
      rows[key] = {
        ...current,
        price: bulk.price.trim() ? bulk.price : current.price,
        cost: bulk.cost.trim() ? bulk.cost : current.cost,
        stock: bulk.stock.trim() ? bulk.stock : current.stock,
      };
    }
    onChange({ ...draft, rows });
  }

  const axisSummary = draft.axes
    .filter((a) => a.values.length)
    .map((a) => `${a.values.length} ${a.name.toLowerCase()}`)
    .join(" × ");

  return (
    <FormSection
      title="Varian"
      description="Produk ini dijual dalam beberapa pilihan, mis. ukuran atau suhu. Tiap varian punya harga dan stok sendiri."
    >
      <div id="variant-matrix" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {lockEnabled
              ? "Produk ini sudah punya varian. Nonaktifkan varian di tabel untuk menyembunyikannya."
              : "Aktifkan jika produk dijual dalam beberapa pilihan (ukuran, suhu, rasa). Harga dan stok lalu diatur per varian."}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            aria-label="Produk punya varian"
            disabled={disabled || lockEnabled}
            onClick={() =>
              update(
                draft.enabled
                  ? { ...draft, enabled: false }
                  : { ...draft, enabled: true, axes: draft.axes.length ? draft.axes : [{ name: "", values: [] }] },
              )
            }
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${draft.enabled ? "bg-primary" : "bg-muted-foreground/40"}`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${draft.enabled ? "left-[1.375rem]" : "left-0.5"}`}
            />
          </button>
        </div>

        {!draft.enabled ? (
          <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            Saat saklar dinyalakan, bagian Harga dan Stok di kanan diganti tabel varian, dan
            nilai yang sudah diisi disalin ke varian pertama.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">1. Jenis varian &amp; pilihannya</p>
              {draft.axes.map((axis, index) => (
                <AxisEditor
                  key={index}
                  axis={axis}
                  groups={groups}
                  takenNames={takenNames}
                  disabled={disabled}
                  onChange={(next) =>
                    update({ ...draft, axes: draft.axes.map((a, i) => (i === index ? next : a)) })
                  }
                  onRemove={() =>
                    update({ ...draft, axes: draft.axes.filter((_, i) => i !== index) })
                  }
                />
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled || !canAddAxis}
                  onClick={() =>
                    update({ ...draft, axes: [...draft.axes, { name: "", values: [] }] })
                  }
                >
                  + Tambah jenis varian
                </Button>
                <span className="text-xs text-muted-foreground">
                  {groups.length === 0 ? (
                    <>
                      Belum ada jenis varian. Buat di{" "}
                      <Link href="/variants" className="underline">
                        menu Varian
                      </Link>
                      .
                    </>
                  ) : (
                    "Jenis diambil dari menu Varian. Pilihan baru bisa diketik langsung di sini."
                  )}
                </span>
              </div>
            </div>

            {list.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">2. Harga &amp; stok per varian</p>
                  <p className="text-xs text-muted-foreground">
                    {list.length} varian dibuat otomatis dari {axisSummary}
                  </p>
                </div>

                <div className="rounded-xl bg-secondary/40 p-3">
                  <p className="mb-2 text-xs font-medium">Isi semua sekaligus</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
                    <Input aria-label="Harga jual semua" inputMode="numeric" placeholder="Harga jual" value={bulk.price} disabled={disabled} onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))} />
                    <Input aria-label="Harga modal semua" inputMode="numeric" placeholder="Harga modal" value={bulk.cost} disabled={disabled} onChange={(e) => setBulk((b) => ({ ...b, cost: e.target.value }))} />
                    <Input aria-label="Stok semua" inputMode="numeric" placeholder="Stok" value={bulk.stock} disabled={disabled || !trackStock} onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value }))} />
                    <Button type="button" variant="secondary" disabled={disabled} onClick={applyAll}>
                      Terapkan ke semua
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Varian</th>
                        <th className="px-2 py-2 font-medium">Harga jual *</th>
                        <th className="px-2 py-2 font-medium">Harga modal</th>
                        <th className="px-2 py-2 font-medium">Stok</th>
                        <th className="px-2 py-2 font-medium">SKU</th>
                        <th className="px-2 py-2 font-medium">Aktif</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((values) => {
                        const key = comboKey(values);
                        const row = draft.rows[key] ?? emptyRow;
                        const open = Boolean(expanded[key]);
                        const invalid = errorKey === key && parseInt32(row.price) === null;
                        return (
                          <Fragment key={key}>
                          <tr className={`border-b border-border/60 ${row.active ? "" : "opacity-60"}`}>
                            <td className="px-3 py-2 font-medium">{comboLabel(values)}</td>
                            <td className="px-2 py-2 align-top">
                              <Input
                                aria-label={`Harga jual ${comboLabel(values)}`}
                                inputMode="numeric"
                                value={row.price}
                                disabled={disabled}
                                aria-invalid={invalid}
                                className={invalid ? "border-destructive" : undefined}
                                onChange={(e) => patchRow(key, { price: e.target.value })}
                              />
                              {invalid ? <span className="text-xs text-destructive">Wajib diisi</span> : null}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <Input aria-label={`Harga modal ${comboLabel(values)}`} inputMode="numeric" value={row.cost} disabled={disabled} onChange={(e) => patchRow(key, { cost: e.target.value })} />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <Input aria-label={`Stok ${comboLabel(values)}`} inputMode="numeric" value={trackStock ? row.stock : ""} placeholder={trackStock ? "" : "∞"} disabled={disabled || !trackStock} onChange={(e) => patchRow(key, { stock: e.target.value })} />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <Input aria-label={`SKU ${comboLabel(values)}`} value={row.sku} disabled={disabled} onChange={(e) => patchRow(key, { sku: e.target.value })} />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={row.active}
                                aria-label={`Aktif ${comboLabel(values)}`}
                                disabled={disabled}
                                onClick={() => patchRow(key, { active: !row.active })}
                                className={`relative mt-1.5 h-5 w-9 rounded-full transition-colors ${row.active ? "bg-primary" : "bg-muted-foreground/40"}`}
                              >
                                <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${row.active ? "left-[1.125rem]" : "left-0.5"}`} />
                              </button>
                            </td>
                            <td className="pr-2 align-top">
                              <button
                                type="button"
                                aria-label={open ? "Tutup detail" : "Buka detail"}
                                aria-expanded={open}
                                onClick={() => setExpanded((p) => ({ ...p, [key]: !open }))}
                                className="mt-1.5 text-muted-foreground"
                              >
                                {open ? "▴" : "▾"}
                              </button>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-border/60 bg-secondary/30">
                              <td colSpan={7} className="px-3 py-3">
                                <div className="grid gap-3 sm:grid-cols-4">
                                  {(
                                    [
                                      ["barcode", "Barcode", false],
                                      ["compareAt", "Harga banding", false],
                                      ["minQty", "Stok min", true],
                                      ["maxQty", "Stok max", true],
                                    ] as const
                                  ).map(([field, label, stockOnly]) => (
                                    <label key={field} className="flex flex-col gap-1 text-xs font-medium">
                                      {label}
                                      <Input
                                        value={row[field]}
                                        inputMode={field === "barcode" ? undefined : "numeric"}
                                        disabled={disabled || (stockOnly && !trackStock)}
                                        onChange={(e) => patchRow(key, { [field]: e.target.value })}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Buka panah di kanan baris untuk barcode, harga banding, dan stok min/max varian
                  itu. Varian yang dinonaktifkan tersembunyi dari menu kasir.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </FormSection>
  );
}

/** Right-column replacement for the Harga card while variants are on. */
export function VariantPriceSummary({ draft }: { draft: VariantDraft }) {
  const s = priceSummary(draft);
  return (
    <FormSection
      title="Harga"
      description="Diatur per varian. Kolom harga tunggal disembunyikan selama varian aktif."
    >
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">Rentang harga jual</p>
        <p className="text-xl font-semibold">
          {s.min === null
            ? "—"
            : s.min === s.max
              ? formatIdr(s.min)
              : `${formatIdr(s.min)} – ${formatIdr(s.max ?? s.min)}`}
        </p>
        {s.missing > 0 ? (
          <p className="text-xs text-destructive">
            {s.missing} dari {s.total} varian belum punya harga
          </p>
        ) : null}
      </div>
      <a href="#variant-matrix" className="text-sm font-medium text-primary underline">
        Atur di tabel varian
      </a>
    </FormSection>
  );
}
