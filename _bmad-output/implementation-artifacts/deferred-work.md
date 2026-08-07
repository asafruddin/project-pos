# Deferred work

## Deferred from: code review of 1-1-scaffold-the-pos-monorepo.md (2026-08-06)

_None — triage deferred zero pre-existing items; low scaffold nits were either patched as action items or dismissed as noise._

## Deferred from: code review of 1-2-account-login-with-roles.md (2026-08-07)

- JwtStrategy trusts JWT `sub`/`role` without DB re-load on every guarded request — Phase 1 only `/auth/me` re-queries users; revisit when more protected routes land.
- No login rate limiting / lockout — acceptable for Phase 1 demo; harden before public exposure.
