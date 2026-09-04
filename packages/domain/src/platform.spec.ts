import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeactivatePlatformOperator,
  evaluatePlatformOperator,
} from "./index";
import { isPlatformRole } from "@pos-apps/types";

describe("isPlatformRole", () => {
  it("accepts super_admin only", () => {
    assert.equal(isPlatformRole("super_admin"), true);
    assert.equal(isPlatformRole("owner"), false);
    assert.equal(isPlatformRole("catalog_admin"), false);
  });
});

describe("evaluatePlatformOperator", () => {
  it("requires username, role, and password on create", () => {
    const ok = evaluatePlatformOperator({
      username: "  ops  ",
      password: "Secret123",
      role: "super_admin",
      require_password: true,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.username, "ops");

    assert.equal(
      evaluatePlatformOperator({
        username: "ab",
        password: "Secret123",
        role: "super_admin",
        require_password: true,
      }).ok,
      false,
    );
    assert.equal(
      evaluatePlatformOperator({
        username: "ops",
        password: "short",
        role: "super_admin",
        require_password: true,
      }).ok,
      false,
    );
    assert.equal(
      evaluatePlatformOperator({
        username: "ops",
        password: "Secret123",
        role: "owner",
        require_password: true,
      }).ok,
      false,
    );
  });
});

describe("canDeactivatePlatformOperator", () => {
  it("forbids self-deactivation and the last super_admin", () => {
    assert.equal(
      canDeactivatePlatformOperator({
        actor_id: "a",
        target_id: "a",
        remaining_active_super_admins: 2,
      }).ok,
      false,
    );
    assert.equal(
      canDeactivatePlatformOperator({
        actor_id: "a",
        target_id: "b",
        remaining_active_super_admins: 0,
      }).ok,
      false,
    );
    assert.equal(
      canDeactivatePlatformOperator({
        actor_id: "a",
        target_id: "b",
        remaining_active_super_admins: 1,
      }).ok,
      true,
    );
  });
});
