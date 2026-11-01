# Authentication session recovery (2026-10-31)

## Incident

A server-side session lookup logged a generic authentication error and threw Better Auth's FAILED_TO_GET_SESSION. The exception propagated through HomePage/getCurrentUser and could also crash the login page, since that page performed the same lookup. Read-only live probes observed connection timeouts and one successful SQL retry; DNS and TCP were reachable. This supports intermittent connectivity as a contributor, but does not identify every underlying provider failure.

## Changes

- Session reads retry once for recognized transport failures or Better Auth's session lookup 500. Known raw credential/schema failures are not repeatedly retried. Missing/expired sessions remain anonymous; unexpected application exceptions and Next control flow still propagate.
- getSessionState distinguishes authenticated, anonymous and unavailable. A protected page never grants access when the lookup is unavailable. Its recovery redirect renders a login notice immediately rather than repeating the same failing lookup in a redirect loop.
- Existing cookies and session rows are retained. Retry connection performs a fresh verification; there is no automatic sign-in replay, cookie-cache authorization, or fallback to a demo identity.
- Recognized dependency failures log sanitized diagnostic codes as warnings instead of generating duplicate development error overlays. Unknown programming errors still log as errors. Logs omit upstream messages, SQL, credentials and cookie contents.
- The auth factory cache refreshes when its configuration factory hot-updates, retaining the shared PostgreSQL pool.

## Automated coverage

25 files / 141 tests, lint, typecheck and default Turbopack build passed. Tests include real Better Auth plus embedded PostgreSQL with a temporarily or persistently failing internal session adapter. They verify recovery, preservation of the saved session, bounded retries, no access on unavailable/expired sessions, safe role validation, diagnostic redaction and the home/login recovery flow.

No browser validation was performed. Live checks were SELECT-only connection/schema probes, not an actual user login; no account, credential, schema or root .env changes were made. Provider/network availability cannot be guaranteed by exception handling.
