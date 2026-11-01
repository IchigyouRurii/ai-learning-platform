# Repository hot-update regression (2026-10-31)

The running development process retained a global platform repository created before listCatalog/findPublishedCourse were added. The old `??=` cache never replaced that object, so an authenticated teacher's marketplace crashed with `listCatalog is not a function` even though a fresh process and build passed.

The cache now tracks the adapter factory. Legacy entries without a factory marker and entries from an older factory are rebuilt. The existing database pool stays cached. The local demo store is cached independently so its serialized mutation queue survives subsequent adapter reloads. Runtime mode selection and permissions are unchanged; there is no fallback from Neon to demo and no fabricated catalog data.

Three regression tests reproduce the legacy Neon singleton, factory reload, and legacy demo singleton followed by another reload. They verify usable catalog methods, stable cache reuse, metadata reads only, and reuse of the demo store without writes. No real credentials, browser, or live database is used by these tests.
