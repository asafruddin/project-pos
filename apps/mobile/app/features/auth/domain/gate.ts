import type { Session } from "./session";

/** Which top-level screen the cashier must see. Mirrors the PWA's `/` routing + PIN guards. */
export type Gate = "login" | "pin" | "app";

export type GateInput = {
  session: Session | null;
  /** Token present and not past its `exp`. */
  tokenValid: boolean;
  /** "Account login happened this shift" — survives a token that expired offline (PWA `SHIFT_KEY`). */
  shiftAuthorized: boolean;
  pinUnlocked: boolean;
};

export function resolveGate({ session, tokenValid, shiftAuthorized, pinUnlocked }: GateInput): Gate {
  // PIN only after an account login this shift — bare PIN material is never enough (FR4).
  if (!session && !shiftAuthorized) return "login";
  if (pinUnlocked) return "app";
  if (tokenValid || shiftAuthorized) return "pin";
  return "login";
}
