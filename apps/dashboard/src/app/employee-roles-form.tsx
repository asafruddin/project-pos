"use client";

import { FormField } from "@pos-apps/ui/molecules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos-apps/ui/molecules";
import {
  FormActions,
  FormBackLink,
  FormBody,
  FormDenied,
  FormSection,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { Checkbox, Input, Skeleton } from "@pos-apps/ui/atoms";
import { CheckCircleIcon, MagnifyingGlassIcon, ShieldCheckIcon, XCircleIcon } from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, Role, RolePermissionsResponse } from "@pos-apps/types";
import { ACCOUNT_ROLES, ROLE_LABELS, hasPermission } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

type PermissionOption = { key: string; resource: string; action: string };

const RESOURCE_LABELS: Record<string, string> = {
  sales: "Penjualan",
  shifts: "Shift kasir",
  products: "Produk",
  customers: "Pelanggan",
  promotions: "Promosi",
  loyalty: "Loyalti",
  reports: "Laporan",
  returns: "Retur",
  inventory: "Persediaan",
  purchases: "Pembelian",
  stores: "Toko",
  transfers: "Transfer stok",
  users: "Pengguna",
  rbac: "Matriks izin",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Lihat",
  create: "Buat",
  update: "Ubah",
  delete: "Hapus",
  approve: "Setujui",
  void: "Batalkan transaksi",
  void_unattended: "Batalkan tanpa kasir",
  view_cost: "Lihat harga modal",
  view_financial: "Lihat finansial",
  export: "Ekspor",
  unpack: "Buka kemasan",
};

const PERMISSION_CATALOG: PermissionOption[] = (
  [
  ["sales", ["view", "create", "void", "void_unattended"]],
  ["shifts", ["view", "create", "update"]],
  ["products", ["view", "create", "update", "delete", "view_cost"]],
  ["customers", ["view", "create", "update", "delete"]],
  ["promotions", ["view", "create", "update", "delete"]],
  ["loyalty", ["view", "update"]],
  ["reports", ["view", "view_financial", "export"]],
  ["returns", ["view", "create", "approve", "update"]],
  ["inventory", ["view", "create", "update", "approve", "unpack"]],
  ["purchases", ["view", "create", "update", "approve"]],
  ["stores", ["view", "update"]],
  ["transfers", ["view", "create", "update", "approve"]],
  ["users", ["view", "create", "update", "delete"]],
  ["rbac", ["update"]],
  ] as Array<[string, string[]]>
).flatMap(([resource, actions]) =>
  actions.map((action) => ({ key: `${resource}:${action}`, resource, action })),
);

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

function permissionLabel(option: PermissionOption): string {
  return ACTION_LABELS[option.action] ?? option.action.replaceAll("_", " ");
}

export function EmployeeRolesForm({
  actorRole,
  permissions,
}: {
  actorRole: Role;
  permissions: string[];
}) {
  const router = useRouter();
  const canEditMatrix = hasPermission(permissions, "rbac", "update");
  const [roles, setRoles] = useState<RolePermissionsResponse["roles"]>([]);
  const [matrixRole, setMatrixRole] = useState<Role>("cashier");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rolesRes = await authorizedFetch("/rbac/roles");
      if (!rolesRes.ok) {
        setError(errorMessage(rolesRes, await rolesRes.json().catch(() => ({}))));
        return;
      }
      const packed = (await rolesRes.json()) as RolePermissionsResponse;
      setRoles(packed.roles);
      setSelectedPermissions(packed.roles.find((r) => r.role === matrixRole)?.permissions ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof Error && (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")) return;
      setError("Gagal memuat matriks izin.");
    } finally {
      setLoading(false);
    }
  }, [matrixRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const permissionOptions = useMemo(() => {
    const known = new Set(PERMISSION_CATALOG.map((option) => option.key));
    const custom = roles.flatMap((role) => role.permissions).filter((key) => !known.has(key)).map((key) => {
      const [resource, action] = key.split(":");
      return { key, resource: resource ?? "other", action: action ?? key };
    });
    return [...PERMISSION_CATALOG, ...custom.filter((option, index, list) => list.findIndex((item) => item.key === option.key) === index)];
  }, [roles]);

  const groupedPermissions = useMemo(() => {
    const query = permissionQuery.trim().toLowerCase();
    const groups = new Map<string, PermissionOption[]>();
    for (const option of permissionOptions) {
      const searchable = `${option.resource} ${RESOURCE_LABELS[option.resource] ?? ""} ${option.action} ${permissionLabel(option)}`.toLowerCase();
      if (query && !searchable.includes(query)) continue;
      const group = groups.get(option.resource) ?? [];
      group.push(option);
      groups.set(option.resource, group);
    }
    return [...groups.entries()];
  }, [permissionOptions, permissionQuery]);

  function setRole(nextRole: Role) {
    setMatrixRole(nextRole);
    setSelectedPermissions(roles.find((role) => role.role === nextRole)?.permissions ?? []);
    setPermissionQuery("");
  }

  function togglePermission(key: string, checked: boolean) {
    setSelectedPermissions((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
  }

  function toggleGroup(options: PermissionOption[], checked: boolean) {
    const keys = new Set(options.map((option) => option.key));
    setSelectedPermissions((current) => checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.has(key)));
  }

  async function saveMatrix(e: FormEvent) {
    e.preventDefault();
    if (!canEditMatrix || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/rbac/roles/${matrixRole}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: selectedPermissions.map((key) => {
          const [resource, action] = key.split(":");
          return { resource: resource ?? "", action: action ?? "" };
        }) }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/employees");
    } catch (err) {
      if (err instanceof Error && (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")) return;
      setError("Gagal menyimpan matriks izin.");
    } finally {
      setPending(false);
    }
  }

  if (!canEditMatrix) {
    return <FormDenied href="/employees">Anda tidak memiliki izin untuk mengubah matriks izin.</FormDenied>;
  }
  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <form onSubmit={(e) => void saveMatrix(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/employees">Daftar karyawan</FormBackLink>
        <FormSection
          title="Matriks izin"
          description={`Tentukan izin yang dimiliki setiap peran. Pengguna dengan peran ini akan mengikuti perubahan izin berikutnya. Anda sedang mengatur: ${ROLE_LABELS[actorRole]}.`}
        >
          <FormField id="matrix-role" label="Peran yang diatur" hint="Perubahan berlaku untuk semua pengguna dengan peran ini." required>
            <Select
              value={matrixRole}
              disabled={pending}
              onValueChange={(value) => setRole(value as Role)}
            >
              <SelectTrigger id="matrix-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><ShieldCheckIcon size={24} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold text-foreground">{selectedPermissions.length} izin dipilih</p><p className="mt-0.5 text-xs text-muted-foreground">Centang izin sesuai tanggung jawab peran ini.</p></div></div>
            <div className="flex gap-2"><button type="button" disabled={pending} onClick={() => setSelectedPermissions(permissionOptions.map((option) => option.key))} className="inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-secondary"><CheckCircleIcon size={15} />Pilih semua</button><button type="button" disabled={pending} onClick={() => setSelectedPermissions([])} className="inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-secondary"><XCircleIcon size={15} />Kosongkan</button></div>
          </div>

          <div className="relative"><MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Cari izin" type="search" value={permissionQuery} onChange={(e) => setPermissionQuery(e.target.value)} placeholder="Cari izin, fitur, atau tindakan…" className="h-10 pl-9" disabled={pending} /></div>

          <div className="grid gap-4 lg:grid-cols-2">
            {groupedPermissions.map(([resource, options]) => {
              const selectedCount = options.filter((option) => selectedPermissions.includes(option.key)).length;
              const allSelected = selectedCount === options.length;
              return <section key={resource} className="overflow-hidden rounded-xl border border-border bg-background/60"><div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3"><div><h3 className="text-sm font-semibold text-foreground">{RESOURCE_LABELS[resource] ?? resource}</h3><p className="mt-0.5 text-xs text-muted-foreground">{selectedCount} dari {options.length} izin dipilih</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground"><Checkbox checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false} onCheckedChange={(checked) => toggleGroup(options, checked === true)} disabled={pending} aria-label={`Pilih semua izin ${RESOURCE_LABELS[resource] ?? resource}`} />Semua</label></div><div className="grid gap-1 p-3 sm:grid-cols-2">{options.map((option) => { const id = `permission-${option.key.replaceAll("_", "-").replace(":", "-")}`; const checked = selectedPermissions.includes(option.key); return <label key={option.key} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-secondary/70"><Checkbox id={id} checked={checked} onCheckedChange={(value) => togglePermission(option.key, value === true)} disabled={pending} /><span className="min-w-0"><span className="block text-sm font-medium text-foreground">{permissionLabel(option)}</span><span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{option.key}</span></span></label>; })}</div></section>;
            })}
          </div>
          {groupedPermissions.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Izin tidak ditemukan. Coba kata kunci lain.</p> : null}
        </FormSection>
      </FormBody>
      <FormActions error={error} pending={pending} submitLabel="Simpan matriks" cancelHref="/employees" />
    </form>
  );
}
