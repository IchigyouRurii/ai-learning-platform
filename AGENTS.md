# Development guide

## Scope

- This is a scaffold with Neon PostgreSQL and Better Auth, not a completed LMS. Live mode is neon; demo must be explicitly selected.
- Use Next.js App Router, strict TypeScript, pnpm. No independent backend or extra frontend app without an agreed need.
- User has selected Neon. Use only the server-side DATABASE_URL from the root .env. Do not claim cloud connectivity before verifying it. Do not deploy or create external accounts without authorization.

## Ownership and boundaries

- Teacher code: `src/modules/teacher/**` and `src/app/(workspace)/teacher/**`.
- Student code: `src/modules/student/**` and `src/app/(workspace)/student/**`.
- Infrastructure: `src/modules/platform/**`, `database/**`, shared infrastructure, root configuration.
- Teacher and student modules must not import each other. Shared course-generation business logic belongs in `src/modules/course-generation/`; both may import its public index.
- Extension contracts live in `src/shared/contracts/features/`. Reserved service entry points are grouped in `src/modules/platform/server/extensions/`; keep each domain in its own file and do not return fabricated success.
- Read `docs/engineering/feature-contracts.md` and `database/design/README.md` before implementing a reserved feature. Resource policies must become enforced server checks and guarded SQL before enabling it. Contract status is not implementation status.
- Import platform services through `@/modules/platform`.
- Shared modules cannot depend on teacher/student code. Client components must never import database/model credentials.
- Prompts and output schemas that describe a business task belong with that task, not in the generic AI client.
- Coordinate changes to contracts, migrations, package dependencies and shared UI. Keep route files thin.

## Data and security

- Demo identity switching is not authentication. Keep it local and clearly labelled.
- Derive actor identity on the server; never accept a user ID as authority from a form.
- Validate model output and external input with Zod. Treat teaching materials and student answers as untrusted data.
- Published revisions and progress must stay linked. Do not mutate published content in place when adding editing.
- New storage adapters must provide atomic updates and enforce ownership/enrollment. Local JSON is single-process only.
- Do not commit secrets, `.local/`, user data, or interview recordings without consent.
- Use only the root `.env` for local configuration and secrets. It is gitignored. Do not recreate `.env.example` or `.env.local`; document configuration keys in README instead.

## Verification

- Run `pnpm lint`, `pnpm typecheck`, relevant tests, and `pnpm build` before merging.
- Add meaningful tests for permissions, contracts and data behavior. Do not write tests that merely mirror component markup.
- Record what is implemented, mocked, unverified and deferred. Update docs when changing an interface.

## Neon and authentication

- Use the explicit PlatformRepository port, parameterized SQL, and ownership/enrollment checks on writes. Never use whole-state JSON mutations for Neon.
- Better Auth owns password hashing and sessions. Role is server-owned and public registration always creates students.
- Run db:migrate deliberately; never apply database/archive SQL. Keep applied migrations immutable.
- Preserve missing-configuration messages and never silently fall back from live mode to demo.

## AI provider

- The selected AI service is OpenRouter. Use the same root .env; never embed model credentials in client code.
- User currently wants free models: preserve AI_FREE_ONLY=true and do not automatically retry with paid models.
- Prompts and course output validation remain in their business modules. Prompt JSON mode is the default for OpenRouter; structured parameters are opt-in.
- ai:check sends one static test request without accessing the database; do not claim a live model was tested without a successful real response.
