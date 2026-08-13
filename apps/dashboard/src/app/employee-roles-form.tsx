"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, Role, RolePermissionsResponse } from "@pos-apps/types";
import { ACCOUNT_ROLES, ROLE_LABELS, hasPermission } from "@pos-apps/types";
import {
  FormActions,
  FormBackLink,
  FormDenied,
  FormField,
  FormSection,
  formSelectClass,
  formTextareaClass,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
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
  const [matrixText, setMatrixText] = useState("");
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
      setMatrixText(
        (packed.roles.find((r) => r.role === matrixRole)?.permissions ?? []).join(
          "\n",
        ),
      );
      setError(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat matriks izin.");
    } finally {
      setLoading(false);
    }
  }, [matrixRole]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMatrix(e: FormEvent) {
    e.preventDefault();
    if (!canEditMatrix || pending) return;
    setPending(true);
    setError(null);
    const nextPermissions = matrixText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((key) => {
        const [resource, action] = key.split(":");
        return { resource: resource ?? "", action: action ?? "" };
      });
    try {
      const res = await authorizedFetch(`/rbac/roles/${matrixRole}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: nextPermissions }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/employees");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan matriks izin.");
    } finally {
      setPending(false);
    }
  }

  if (!canEditMatrix) {
    return (
      <FormDenied href="/employees">
        Anda tidak memiliki izin untuk mengubah matriks izin.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void saveMatrix(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/employees">Daftar karyawan</FormBackLink>
      <FormSection
        title="Matriks izin"
        description={`Satu izin per baris (resource:action). Berlaku pada permintaan API berikutnya — bukan hanya hide/show UI. Peran: ${ROLE_LABELS[actorRole]}.`}
      >
        <FormField id="matrix-role" label="Peran" required>
          <select
            id="matrix-role"
            className={formSelectClass}
            value={matrixRole}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as Role;
              setMatrixRole(next);
              setMatrixText(
                (roles.find((r) => r.role === next)?.permissions ?? []).join("\n"),
              );
            }}
          >
            {ACCOUNT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="matrix-text" label="Izin">
          <textarea
            id="matrix-text"
            className={`${formTextareaClass} min-h-48 font-mono text-xs`}
            value={matrixText}
            disabled={pending}
            onChange={(e) => setMatrixText(e.target.value)}
          />
        </FormField>
      </FormSection>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan matriks"
        cancelHref="/employees"
      />
    </form>
  );
}
