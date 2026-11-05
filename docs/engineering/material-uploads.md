# Course material uploads

## Fixes

Quiz uses a wrapped heading inside its legend, and scoped option/radio styling overrides full-width general form rules. Radio/checkbox controls remain beside their option text; long questions and answers wrap.

PDF extraction passes a copy to unpdf. The parser can transfer/detach its input buffer; the original must remain intact to save and download the attachment. The supplied 14,245,018-byte PDF extracted 139,650 characters locally after the fix, with all source bytes preserved. The original document is not committed.

## Transport

Vercel Functions accept at most 4.5 MB per request. The browser now sends sequential 3,000,000-byte multipart chunks for files up to 20,000,000 bytes. Every request carries one UUID, offset and total size. Non-JSON/413 responses produce a useful message rather than a JSON parsing error.

Migration: `202611050001_material_upload_chunks.sql`. Staging is private to the server-derived owner; only teachers and students may upload. Metadata and offsets must match; append is atomic. Each owner may have five active uploads, which expire after 30 minutes. Completed uploads are parsed on the server and saved using existing material ownership rules. Staging is removed after success; expired rows are cleaned on the owner's next upload. No object storage account or additional service is required.

Existing direct-upload API remains compatible. Staging is not a published material and cannot be read through the normal material download endpoint. Demo assembly is process-local and does not provide multi-instance/resumable uploads.

## Verification and limits

System tests cover chunk order, mismatched ownership/metadata, expiry, client request sizes, non-JSON errors and buffer preservation. Full lint, typecheck, tests and production build run locally. No browser verification or deployed upload test; the deployment must include this branch and migration before the new flow works online. Large original-file downloads still use the existing endpoint and can encounter Vercel's response-size limit; this change addresses upload and extraction only.

## Upload latency

14,245,018 bytes now require 5 sequential requests rather than 15. Each chunk uses one append query, rather than an unsuccessful insert followed by an update. Final persistence copies the assembled bytes inside PostgreSQL with owner/metadata/completeness guards, avoiding retransmitting the whole file from the application server. Progress text distinguishes acknowledged upload progress from the final upload/extraction/save phase. The 20 MB file limit is unchanged, and 3 MB chunks remain below the hosting request cap. No additional migration is needed. Actual end-to-end speed still depends on the network and database; no browser timing measurements were taken.

## Long reference preparation

Before generating courses or adding lessons, reference text is condensed to at most 8,000 characters. This is extractive selection, not an additional AI call: relevant source passages are ranked against the topic and goals, selected across the file, then kept in source order. Text within the budget is unchanged, and the original attachment remains intact. The prompt identifies the result as selected excerpts rather than a complete summary. This replaces the former blind first-20,000-character truncation.

Course generation requests now allow 12,000 output tokens (previously 6,000) for the existing 3 lessons × 10 pages + 15 questions structure, with explicit short-page and short-explanation instructions. These changes reduce input size and provide enough room for the required response, but cannot guarantee a live provider will never truncate. Tests and the supplied PDF verify extraction/condensation locally; no live AI request was made for this change.

## AI response transport

Course generation and its existing one-time schema repair opt into OpenRouter streaming. The server assembles the response before business validation, ignores SSE keep-alive/comments and reasoning fields, and requires both a finish reason and stream terminator. Truncated or interrupted responses remain failures. Other tasks retain ordinary JSON transport by default. Errors now distinguish gateway HTML, incomplete JSON, body-read interruption and incomplete SSE; safe diagnostic logs contain only HTTP status, content type and response length. No response text, documents or credentials are logged. A single minimal real AI connection check succeeded; full live course generation and browser verification were not performed.

## Segmented course generation

The 12,000-token whole-course attempt could still truncate. Live generation now requests a compact three-lesson outline (3,000 output tokens), followed by three individually validated lessons (8,000 each). Each lesson remains exactly 10 pages and 5 questions; the final course has 3 lessons. Server-assigned chapter and difficulty prefixes isolate model-reused IDs and preserve correct-answer references. An incomplete chapter cannot be presented as a complete course, and errors identify its chapter number. Existing mock behavior remains local and explicit. The original full-course repair prompt is no longer the active generation workflow.

Live verification on 2026-11-05 used the supplied product-management PDF excerpts and soft/product-skills topic. Beginner completed in 180 seconds, with exactly 3 lessons, [10,10,10] pages and [5,5,5] questions. The draft was stored only as a temporary local verification file; no course was inserted or published. Advanced/Expert and browser behavior were not live-verified. This supersedes the earlier whole-course generation verification limitation.

## Generation latency

Each difficulty still makes four AI calls (one outline and three chapters), but the three chapters now run concurrently using the same validated outline. Their results are assembled in outline order, regardless of completion order. Concurrency is capped at three within one course generation; difficulty levels remain sequential. All chapter responses settle before returning a failure, and incomplete levels remain failures rather than partial courses. No automatic retries, provider changes, or credential changes are introduced. With no attachments, the action also skips the material database lookup.

This removes serial waits without reducing the existing 3 × 10 pages / 15 questions per difficulty. Mocked tests verify concurrent starts, out-of-order completion, validation and rate-limit propagation. Actual improvement depends on provider capacity and network conditions; no live speedup measurement or browser verification was performed for this optimization.

## Adaptive lesson length and truncation recovery

Lesson generation now lets the AI choose 1-10 pages (usually 3-6), based on the topic, rather than requiring all ten. Five quiz questions remain required. This applies to new courses and added lessons; existing course content is unchanged. A finish_reason=length can occur without attachments because it is an output limit. Only this explicit truncation triggers one same-model chapter retry with 1-3 concise pages and a 12,000-token budget. Authentication, quota, rate-limit and network errors are not retried. Failed levels still do not return partial chapters. The earlier fixed-ten-page and no-retry descriptions are superseded by this section.

Validation for the latency/adaptive-length changes: lint, typecheck and 225 tests passed. The default Turbopack build encountered a local process/port permission error; `pnpm build --webpack` passed. Live generation latency and provider truncation recovery were not measured against the real model for these changes.

## Three-level scheduling, adaptive quizzes and 5 MB uploads

All selected difficulty levels now run in one authenticated server action. Attachment ownership lookup and reference condensation happen once. A per-job queue limits all outline/chapter model work to three concurrent requests across levels; a slow level no longer prevents another level from starting. The action returns a result per level after the job settles, preserving successful levels and identifying failed levels for individual regeneration. Results are not streamed to the browser. The existing single-level action remains compatible. No model, API key, free-only setting or provider fallback is changed. Total AI request count is unchanged; the optimization removes scheduling barriers and repeated preparation, not provider latency.

Newly generated chapters contain 1-5 quiz questions chosen for content coverage (usually 2-3), with 1-10 pages as before. Validation rejects empty quizzes and more than five questions. Existing published courses and their progress remain unchanged.

New uploads must be smaller than 5 MB (decimal 5,000,000 bytes; maximum accepted size 4,999,999). Client validation, route validation, extraction and upload-session service validation enforce the boundary. The 3 MB chunk transport remains necessary for hosting request limits. Existing attachment metadata and the applied staging migration keep their historical 20 MB capacity for compatibility; application checks enforce the stricter limit on new uploads. No migration or deletion of existing files is needed.

Mocked tests cover the three-request concurrency limit, failure slot release, authorization and attachment ownership, independent per-level failures, adaptive quiz lengths, and the exact upload boundary. No live generation speed benchmark or browser verification was performed.

Final validation: lint, typecheck, all 234 tests and the Webpack production build passed. The default Turbopack build retains the local process/port permission limitation noted above.
