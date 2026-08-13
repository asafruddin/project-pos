import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAssignRole,
  canEditPermissionMatrix,
  canOpenEmployees,
  defaultPermissionsForRole,
  evaluateUserAccount,
  grantsFor,
  hasPermission,
} from "./index";

describe("hasPermission / default matrix", () => {
  it("maps cashier → Cashier without refund, stock, or price", () => {
    const grants = defaultPermissionsForRole("cashier");
    assert.equal(hasPermission(grants, "sales", "create"), true);
    assert.equal(hasPermission(grants, "sales", "void"), true);
    assert.equal(hasPermission(grants, "shifts", "create"), true);
    assert.equal(hasPermission(grants, "reports", "view"), true);
    assert.equal(hasPermission(grants, "returns", "approve"), false);
    assert.equal(hasPermission(grants, "inventory", "update"), false);
    assert.equal(hasPermission(grants, "products", "update"), false);
    assert.equal(hasPermission(grants, "users", "create"), false);
  });

  it("lets supervisor void unattended but not refund", () => {
    const grants = defaultPermissionsForRole("supervisor");
    assert.equal(hasPermission(grants, "sales", "void_unattended"), true);
    assert.equal(hasPermission(grants, "returns", "approve"), false);
    assert.equal(hasPermission(grants, "products", "update"), false);
    assert.equal(hasPermission(grants, "users", "create"), false);
  });

  it("lets store manager refund / adjust / price, but not manage users", () => {
    const grants = defaultPermissionsForRole("store_manager");
    assert.equal(hasPermission(grants, "returns", "approve"), true);
    assert.equal(hasPermission(grants, "inventory", "update"), true);
    assert.equal(hasPermission(grants, "products", "update"), true);
    assert.equal(hasPermission(grants, "users", "create"), false);
    assert.equal(hasPermission(grants, "rbac", "update"), false);
    assert.equal(hasPermission(grants, "stores", "view"), true);
    assert.equal(hasPermission(grants, "stores", "update"), false);
    assert.equal(hasPermission(grants, "transfers", "approve"), true);
  });

  it("keeps catalog_admin as Admin (FR-103) with user-admin", () => {
    const grants = defaultPermissionsForRole("catalog_admin");
    assert.equal(hasPermission(grants, "products", "update"), true);
    assert.equal(hasPermission(grants, "users", "create"), true);
    assert.equal(hasPermission(grants, "rbac", "update"), true);
    assert.equal(hasPermission(grants, "stores", "update"), true);
    assert.equal(hasPermission(grants, "transfers", "approve"), true);
  });

  it("lets inventory staff draft transfers but not approve ship/receive", () => {
    const grants = defaultPermissionsForRole("inventory_staff");
    assert.equal(hasPermission(grants, "stores", "view"), true);
    assert.equal(hasPermission(grants, "transfers", "create"), true);
    assert.equal(hasPermission(grants, "transfers", "update"), true);
    assert.equal(hasPermission(grants, "transfers", "approve"), false);
    assert.equal(hasPermission(grants, "stores", "update"), false);
  });
});

describe("grantsFor", () => {
  it("prefers request grants so matrix edits apply on the next request", () => {
    assert.equal(
      hasPermission(
        grantsFor({ role: "cashier", permissions: ["returns:approve"] }),
        "returns",
        "approve",
      ),
      true,
    );
    assert.equal(
      hasPermission(grantsFor({ role: "cashier" }), "returns", "approve"),
      false,
    );
  });
});

describe("canAssignRole / employees access", () => {
  it("only Owner and Admin open Employees; Store Manager cannot create admins", () => {
    assert.equal(canOpenEmployees("catalog_admin"), true);
    assert.equal(canOpenEmployees("owner"), true);
    assert.equal(canOpenEmployees("store_manager"), false);
    assert.equal(canOpenEmployees("cashier"), false);
    assert.equal(canEditPermissionMatrix("store_manager"), false);

    assert.equal(
      canAssignRole({ actor_role: "store_manager", target_role: "catalog_admin" }),
      false,
    );
    assert.equal(
      canAssignRole({ actor_role: "catalog_admin", target_role: "cashier" }),
      true,
    );
    assert.equal(
      canAssignRole({ actor_role: "catalog_admin", target_role: "owner" }),
      false,
    );
    assert.equal(
      canAssignRole({ actor_role: "owner", target_role: "owner" }),
      true,
    );
  });
});

describe("evaluateUserAccount", () => {
  it("requires username, role, store, and password on create", () => {
    const ok = evaluateUserAccount({
      username: "  ana  ",
      password: "Secret123",
      role: "cashier",
      store_id: "store-1",
      require_password: true,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.username, "ana");

    assert.equal(
      evaluateUserAccount({
        username: "ab",
        password: "Secret123",
        role: "cashier",
        store_id: "store-1",
        require_password: true,
      }).ok,
      false,
    );
  });
});
