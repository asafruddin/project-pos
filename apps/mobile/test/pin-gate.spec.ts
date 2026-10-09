import { resolveGate } from "@/features/auth/domain/gate";
import type { Session } from "@/features/auth/domain/session";
import { isSixDigitPin, lockDurationMs, PinService } from "@/features/pin/domain/pin-service";
import { fakeClock } from "./helpers/test-db";
import { fakeHasher, MemoryLockoutStore, MemoryPinStore } from "./helpers/harness";

const session: Session = {
  accessToken: "t",
  userId: "u1",
  role: "cashier",
  permissions: [],
  storeId: "s",
  storeName: "Store",
  storeLogoUrl: null,
  registerId: null,
};

describe("resolveGate", () => {
  it.each([
    // [session, tokenValid, shiftAuthorized, pinUnlocked, expected]
    [null, false, false, false, "login"],
    [null, false, false, true, "login"], // a PIN without an account login never opens the till
    [session, true, true, false, "pin"],
    [session, true, true, true, "app"],
    [{ ...session, accessToken: null }, false, true, false, "pin"], // token expired offline: PIN still unlocks
    [{ ...session, accessToken: null }, false, true, true, "app"],
    [session, true, false, false, "pin"], // fresh token before the flag is set
    [session, false, false, false, "login"], // dead token and no shift flag
  ] as const)("session=%#", (s, tokenValid, shiftAuthorized, pinUnlocked, expected) => {
    expect(resolveGate({ session: s, tokenValid, shiftAuthorized, pinUnlocked })).toBe(expected);
  });
});

describe("PinService", () => {
  const make = () => {
    const clock = fakeClock();
    const pins = new PinService(new MemoryPinStore(), fakeHasher, new MemoryLockoutStore(), clock);
    return { pins, clock };
  };

  it("validates the PIN format", async () => {
    const { pins } = make();
    expect(isSixDigitPin("123456")).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", ""]) {
      await expect(pins.enroll("u1", bad)).rejects.toThrow("PIN_INVALID_FORMAT");
    }
  });

  it("enrols, then verifies by user id or without knowing the user (offline unlock)", async () => {
    const { pins } = make();
    expect(await pins.hasMaterial("u1")).toBe(false);
    expect(await pins.verify("u1", "123456")).toEqual({ ok: false, reason: "no_material" });
    await pins.enroll("u1", "123456");
    expect(await pins.hasMaterial("u1")).toBe(true);
    expect(await pins.verify("u1", "123456")).toEqual({ ok: true });
    expect(await pins.verify(null, "123456")).toEqual({ ok: true });
    expect(await pins.verify("u1", "654321")).toEqual({ ok: false, reason: "wrong", attemptsLeft: 4 });
  });

  it("keeps the manager PIN separate from the user PIN", async () => {
    const { pins } = make();
    await pins.enroll("u1", "111111");
    expect(await pins.hasManagerPin()).toBe(false);
    await pins.enrollManager("222222");
    expect((await pins.verifyManager("111111")).ok).toBe(false);
    expect((await pins.verifyManager("222222")).ok).toBe(true);
    expect((await pins.verify("u1", "222222")).ok).toBe(false);
  });

  it("manager PIN: default 000000 until the owner's material is synced; null goes back to the default", async () => {
    const { pins } = make();
    expect((await pins.verifyManager("000000")).ok).toBe(true);
    expect((await pins.verifyManager("482913")).ok).toBe(false);
    await pins.syncManager({ salt: "c2FsdA==", hash: await fakeHasher.hash("482913", "c2FsdA==", 5), iterations: 5 });
    expect((await pins.verifyManager("482913")).ok).toBe(true);
    expect((await pins.verifyManager("000000")).ok).toBe(false);
    await pins.syncManager(null);
    expect((await pins.verifyManager("000000")).ok).toBe(true);
  });

  it("locks for 30 s after 5 wrong PINs, doubling on each further failure, and resets on success", async () => {
    const { pins, clock } = make();
    await pins.enroll("u1", "111111");
    for (let i = 1; i <= 4; i += 1) expect(await pins.verify("u1", "000000")).toMatchObject({ reason: "wrong", attemptsLeft: 5 - i });
    expect(await pins.verify("u1", "000000")).toEqual({ ok: false, reason: "locked", retryAfterMs: 30_000 });
    // Locked: even the correct PIN is refused and no hash is computed.
    expect(await pins.verify("u1", "111111")).toMatchObject({ reason: "locked" });
    clock.advance(30_001);
    expect(await pins.verify("u1", "000000")).toEqual({ ok: false, reason: "locked", retryAfterMs: 60_000 });
    clock.advance(60_001);
    expect(await pins.verify("u1", "111111")).toEqual({ ok: true });
    expect(await pins.verify("u1", "000000")).toMatchObject({ reason: "wrong", attemptsLeft: 4 });
  });

  it("caps the lock at 15 minutes", () => {
    expect(lockDurationMs(4)).toBe(0);
    expect(lockDurationMs(5)).toBe(30_000);
    expect(lockDurationMs(6)).toBe(60_000);
    expect(lockDurationMs(40)).toBe(15 * 60_000);
  });

  it("re-enrolling resets the lockout", async () => {
    const { pins } = make();
    await pins.enroll("u1", "111111");
    for (let i = 0; i < 5; i += 1) await pins.verify("u1", "000000");
    await pins.enroll("u1", "222222");
    expect(await pins.verify("u1", "222222")).toEqual({ ok: true });
  });
});

describe("NoblePinHasher (real PBKDF2-SHA256)", () => {
  // Imported lazily so the specs above never depend on it.
  const make = (iterations = 1000) => {
    const { NoblePinHasher } = jest.requireActual("@/features/pin/data/noble-pin-hasher") as typeof import("@/features/pin/data/noble-pin-hasher");
    let n = 0;
    return new NoblePinHasher((len) => Uint8Array.from({ length: len }, (_, i) => (i + ++n) % 256), iterations);
  };

  it("is deterministic per (pin, salt, iterations) and differs when any input changes", async () => {
    const h = make();
    const salt = h.salt();
    const a = await h.hash("123456", salt, 1000);
    expect(await h.hash("123456", salt, 1000)).toBe(a);
    expect(await h.hash("123457", salt, 1000)).not.toBe(a);
    expect(await h.hash("123456", salt, 1001)).not.toBe(a);
    expect(await h.hash("123456", h.salt(), 1000)).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("matches the PBKDF2-HMAC-SHA256 reference vector (RFC 7914 style: P=password, S=salt, c=1, dkLen=32)", async () => {
    const h = make();
    const saltB64 = Buffer.from("salt").toString("base64");
    const out = await h.hash("password", saltB64, 1); // pin format is not enforced by the hasher itself
    expect(Buffer.from(out, "base64").toString("hex")).toBe("120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b");
  });

  it("works end to end with PinService at the production iteration count, within a sane time", async () => {
    const h = make(50_000);
    const pins = new PinService(new MemoryPinStore(), h, new MemoryLockoutStore(), fakeClock());
    const started = Date.now();
    await pins.enroll("u1", "246810");
    expect((await pins.verify("u1", "246810")).ok).toBe(true);
    expect((await pins.verify("u1", "246811")).ok).toBe(false);
    // Node is far faster than Hermes; this only guards against an accidental order-of-magnitude regression.
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
