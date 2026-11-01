# Historical navigation, search and profile menu verification (2026-10-31)

- Sidebar: pointer entry expands; exit collapses. Navigation preserves expansion while the pointer remains inside. Keyboard focus can expand it; the pin button remains removed.
- Catalog search: Enter and the search button update the current course list and URL through the History API, without a full-page Preparing your workspace screen. Subject filters and browser Back/Forward remain supported. From pages without a catalog, search uses client navigation to the marketplace.
- Profile menu: outside clicks, focus leaving the menu, and Escape close it. Escape returns focus to the summary.
- Navigation: production full-route prefetching begins on hover/focus. The workspace shell remains visible with content skeletons instead of spinning indicators. Independent workspace queries and student home reads run in parallel; actor-scoped SQL and permissions are unchanged, with no new global data cache.
- Teacher marketplace remains display-only; My Creations uses authenticated workspace data. The three previously requested redundant messages remain removed.

Validation: lint, typecheck, 20 test files / 114 tests, and default Turbopack production build passed. Tests cover query encoding, retained subjects, empty searches, navigation from non-catalog pages, and parallel query startup; SQL integration tests continue to cover permissions and data behavior.

Local production preview used APP_MODE=demo and AI_PROVIDER=mock. Verified that navigation to My Creations keeps the hovered sidebar expanded, and clicking the page heading collapses it. Enter-search Requirements returns two courses in My Creations; button-search Prioritization returns one. Marketplace search Python returns one course. Profile outside-click and Escape both close the menu.

No real Neon writes or AI calls were performed; root .env was unchanged. Real network latency was not benchmarked, and development first compilation or remote database reads may still take time.

Screenshot: [Inline catalog search](catalog-search-fixed.png).

This records the earlier navigation-only preview. The current catalog no longer uses sample courses; see [Course marketplace](../../engineering/course-marketplace.md) for current implementation and automated coverage.
