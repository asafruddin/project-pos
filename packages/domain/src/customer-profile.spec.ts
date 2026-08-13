import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCustomerProfile } from "./index";

describe("evaluateCustomerProfile", () => {
  it("accepts name + phone", () => {
    const result = evaluateCustomerProfile({
      name: "  Sari  ",
      phone: " 0812 ",
      notes: "  ",
      group_name: "",
    });
    assert.deepEqual(result, {
      ok: true,
      name: "Sari",
      phone: "0812",
      email: null,
      notes: null,
      group_name: null,
    });
  });

  it("accepts name + email and optional group", () => {
    const result = evaluateCustomerProfile({
      name: "Budi",
      email: "budi@shop.id",
      group_name: " Regular ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.group_name, "Regular");
      assert.equal(result.email, "budi@shop.id");
    }
  });

  it("rejects missing name, missing contact, and invalid email", () => {
    const noName = evaluateCustomerProfile({ name: "  ", phone: "0812" });
    assert.equal(noName.ok, false);
    if (!noName.ok) assert.equal(noName.code, "CUSTOMER_NAME_REQUIRED");

    const noContact = evaluateCustomerProfile({ name: "Sari" });
    assert.equal(noContact.ok, false);
    if (!noContact.ok) assert.equal(noContact.code, "CUSTOMER_CONTACT_REQUIRED");

    const badEmail = evaluateCustomerProfile({ name: "Sari", email: "not-an-email" });
    assert.equal(badEmail.ok, false);
    if (!badEmail.ok) assert.equal(badEmail.code, "CUSTOMER_INVALID_EMAIL");
  });

  it("missing group does not fail", () => {
    const result = evaluateCustomerProfile({ name: "Sari", phone: "0812" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.group_name, null);
  });

  it("drops invalid email when phone is present (fail-open)", () => {
    const result = evaluateCustomerProfile({
      name: "Sari",
      phone: "0812",
      email: "not-an-email",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.phone, "0812");
      assert.equal(result.email, null);
    }
  });
});
