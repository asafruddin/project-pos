# Cashier flow: open → close

Ported from the PWA (`apps/cashier`); every gate is a pure function or a use case with tests.

```
cold start ──► gate: login ──(POST /auth/login, needs sales:create)──► gate: pin
                                                                       │ first time (online): choose PIN
                                                                       │ afterwards (offline ok): unlock
                                                                       ▼
                                              open shift left on the device?
                                          yes ──► Shift screen  (intent close-then-open: count + close it first)
                                          no  ──► gate: app
gate: app
  no open shift ──► blocking "Open shift" dialog (any screen except Shift / Day close / Settings)
  Menu → cart → pay (cash | QRIS) → receipt → sale + outbox rows in ONE transaction
  Transactions: receipt · void (same day) · return (online)
  Customers · Settings
  Shift: cash in/out → count → close (warns on a difference)
  Day close: summary → (gate) → report → confirm → end ACCOUNT session  ──► gate: login
sign out with a shift open → Shift screen (intent logout) → close → end session
```

## Gate rules (`features/auth/domain/gate.ts`)

| session | token valid | shift authorised | PIN unlocked | gate |
|---|---|---|---|---|
| none | – | no | – | **login** |
| any | yes/no | yes | no | **pin** (PIN works offline, even with an expired token) |
| any | yes | no | no | **pin** |
| any | – | yes | yes | **app** |

A PIN **alone** never opens the till: an account login this shift is required (PWA FR4). `pinUnlocked` is in memory
only, so a cold start always asks for the PIN again.

## Deliberate differences from the PWA

- **Token death mid-shift** does not force "close the shift": the PWA logs out and the next PIN unlock then demands
  `close-then-open`. Here the till keeps working, sync pauses (`auth_required`), and "Sign in" in the banner renews the
  token. If the *same user* signs in, the cashier returns straight to the till (no PIN, shift untouched); a different
  user goes through the normal PIN gate.
- **PIN lockout**: 5 wrong PINs lock the scope for 30 s, doubling per further failure up to 15 min. The PIN hash lives
  in Keystore-backed SecureStore, not in the database.
- **Unattended void** (permission `sales:void_unattended`) asks for a confirmation dialog; the PWA voids immediately.
- Hold/resume, void and returns use bottom sheets and dialogs instead of the PWA's table rows and modals.

## PIN storage and hashing

PBKDF2-HMAC-SHA256 via `@noble/hashes` (Hermes has no WebCrypto), 50 000 iterations, 16-byte random salt, stored
with the iteration count so it can be raised later. Verified against the RFC reference vector in `test/pin-gate.spec.ts`.
**TODO on a real device:** time `enroll`/`verify`; if it is far above ~300 ms lower `NoblePinHasher.defaultIterations`.
A 6-digit PIN is brute-forceable offline whatever the iteration count, which is why the lockout exists.
