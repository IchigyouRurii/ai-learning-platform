# Read-only connectivity diagnostics (2026-10-31)

The user's db:check screenshot contained a future SSL behavior warning followed by a generic database failure. The warning itself did not identify the failed operation.

The shared diagnostics module now classifies safe database failure codes, including uncoded node-postgres timeout errors and nested AggregateError/cause objects. Both authentication recovery and database scripts use it. CLI diagnostics use static messages; DEBUG_DB no longer prints potentially sensitive upstream messages.

A live SELECT-only db:check reproduced CONNECTION_TIMEOUT with exit code 1. It did not reach the initialization check. This is evidence of a timed-out connection from this machine, not proof of a provider-wide outage, missing tables, or data loss. Earlier probes showed successful DNS/TCP and one successful SELECT 1, so cloud availability should be compared against the Neon console on the same branch/database. No migration, credential, SSL policy or .env change was made.

Automated regression coverage checks timeouts, credential/schema codes, nested causes, unknown errors and redaction; the authentication recovery suite is rerun after sharing the classifier. Browser validation is intentionally omitted.
