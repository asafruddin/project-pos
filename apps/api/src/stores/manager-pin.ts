import type { ManagerPinMaterial } from "@pos-apps/types";
import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

/** Same scheme as the devices (PBKDF2-HMAC-SHA256, 32 bytes, base64), so they can verify it offline. */
const ITERATIONS = 100_000;

export function isSixDigitPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export async function hashManagerPin(pin: string): Promise<ManagerPinMaterial> {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(pin, salt, ITERATIONS, 32, "sha256");
  return {
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
    iterations: ITERATIONS,
  };
}

export function managerPinMaterial(row: {
  managerPinHash: string | null;
  managerPinSalt: string | null;
  managerPinIterations: number | null;
}): ManagerPinMaterial | null {
  if (!row.managerPinHash || !row.managerPinSalt || !row.managerPinIterations) return null;
  return { salt: row.managerPinSalt, hash: row.managerPinHash, iterations: row.managerPinIterations };
}
