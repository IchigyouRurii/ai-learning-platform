# Neon connection and session recovery

Date: 2026-11-01. No browser verification; no cloud data writes or migrations.

## Findings

The supplied logs show two 10-second session connection attempts (about 20s per login page). A fresh TCP check could succeed while the application's cached path had timed out, so neither an invalid password nor a permanent database outage was established. The body hydration diff independently identifies extension-injected `cz-shortcut-listen`.

Native direct WebSocket initially timed out too. Through the existing explicit HTTP CONNECT proxy on the user's machine, three real Neon SELECTs passed (2754/141/140ms), as did a pinned read-only transaction. The application's new pool also passed db:check. One subsequent cold probe failed with an unclassified dependency error; networking is not claimed infallible. A later complete idle/reconnect probe passed at 852/835/593ms, then five parallel SELECTs and a read-only transaction against session/account tables passed. No session tokens, user records, credentials or raw upstream errors were printed.

## Changes

- Official Neon PostgreSQL-compatible WebSocket Pool with optional explicit DATABASE_PROXY_URL; no global shell proxy guessing, HTTP-SQL substitution, write replay, demo fallback or provider switch. TLS certificate validation retained. The local root .env selects the proxy path verified above; .env remains gitignored.
- 5s connection budget, idle recycling, max connection lifetime. Cache keys include configuration and factory identity; ended pools are replaced. Auth, course, classroom, administration, content annotation and discussion adapters rebind to replacement pools.
- One automatic saved-session recovery check, online event recovery and manual checking button; finite timeout, cancellation and no endless polling. Anonymous/invalid roles never gain access; sign-in/registration are not automatically replayed.
- Body-attribute-only hydration compatibility for external extension attributes; child checks remain active.

## Verification

Lint, strict typecheck, 34 files / 175 tests, and default Turbopack production build passed. Tests cover pool replacement, transport selection, explicit proxy validation, adapter/auth cache behavior, server-verified session probe responses, Better Auth's existing authentication lifecycle, and permission/data behavior. Actual user sign-in was not exercised because no credentials were requested. User should restart the dev process after dependency and .env changes, then verify sign-in. Local proxy must remain running; a VPN/ISP outage remains an external dependency, not something application code can guarantee away.

Dependency installation from the default registry timed out. A reachable registry mirror installed the official packages; only four direct dependency additions and their lockfile entries changed.
