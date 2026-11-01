# Teacher course catalog

## User flow

- Sidebar labels: My Creation and Class. Existing URLs are unchanged.
- My Creation lists all courses owned by the signed-in teacher, including drafts and withdrawn courses. There are no subject tabs, and old subject parameters do not hide courses. Text search remains available.
- A draft stays private. The author reviews and publishes it through the existing publishing flow; the published course then appears automatically in Marketplace.
- Marketplace lists real published, active cohort courses from all authors. Personal courses, drafts and withdrawn courses are excluded. The original sample fixture is no longer imported by the application.
- Subject and author/title filtering remain inline. The three difficulty buttons retain their design, but explicitly explain that separate difficulty versions are not yet implemented.
- Public details live at `/teacher/marketplace/[id]`. Editing stays at the existing owner-only `/teacher/courses/[id]` route. Marketplace viewers do not gain editing rights or teacher enrollment capability.

## Data boundary

`getCourseCatalog` and `getPublishedCourse` are server APIs exported from `@/modules/platform`. They require a server-derived authenticated actor. Both Neon and explicitly selected local demo repositories implement these reads through PlatformRepository.

Neon catalog queries join the immutable published revision and author. SQL filters enforce published status, cohort visibility and active moderation; detail IDs are parameterized. The list selects metadata only, with no lesson bodies or quiz answers. Detail content is explicitly whitelisted and passed through the existing safe-course projection to strip correct options and explanations. Local demo reads follow the same visibility rules and published-snapshot semantics.

Publishing invalidates Marketplace, My Creation, student listing and relevant detail routes. This change uses existing tables and migrations; it does not migrate or automatically publish existing drafts. The broader reserved `platformExtensions.courseManagement` contract remains reserved; the implemented reads use the primary platform service API.

## Verification

118 automated tests passed, including SQL and local repository coverage for draft-to-published visibility, cross-teacher access, unpublished edit isolation, private-course exclusion, withdrawn-course exclusion, metadata-only cards and answer-key removal. Tests use embedded PostgreSQL/local state, not the live Neon database. TypeScript and ESLint passed. The default Turbopack production build passed.

Browser verification is left to the user, as requested. No cloud data or publication status was modified by this implementation task.

课程三档难度及旧数据兼容规则见 [课程难度](course-difficulty.md)。科目统一使用共享 `COURSE_SUBJECTS`，未知历史分类展示到 Other。
