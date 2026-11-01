import type { Pool } from "pg";
import { z } from "zod";
import { courseIntroductionSchema } from "../../../src/shared/contracts/course";

export const introductionPlanSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      ownerId: z.string().min(1),
      draftRevision: z.number().int().positive(),
      publishedVersion: z.number().int().positive().nullable(),
      previous: z.string(),
      publishedPrevious: z.string().nullable(),
      introduction: courseIntroductionSchema,
      publish: z.boolean().default(true),
    }),
  )
  .min(1)
  .superRefine((items, ctx) => {
    if (new Set(items.map((item) => item.id)).size !== items.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate course in introduction plan",
      });
  });

/** Explicit operator maintenance, not an authenticated application endpoint.
 * Exact owner/revision/text guards prevent applying a stale plan to teammates' edits.
 * Existing publications and learning records are never rewritten.
 */
export async function shortenIntroductions(pool: Pool, raw: unknown) {
  const plan = introductionPlanSchema.parse(raw);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const results = [];
    for (const item of [...plan].sort((a, b) => a.id.localeCompare(b.id))) {
      const locked = await client.query<{
        draft_revision: number;
        published_version: number | null;
        version: number;
        description: string;
        published_description: string | null;
      }>(
        `select c.draft_revision, c.published_version, c.version,
        c.draft_content->>'description' as description,
        r.content->>'description' as published_description
        from courses c left join course_revisions r on r.course_id=c.id and r.version=c.published_version
        where c.id=$1 and c.owner_id=$2 for update of c`,
        [item.id, item.ownerId],
      );
      const row = locked.rows[0];
      if (
        !row ||
        row.draft_revision !== item.draftRevision ||
        row.published_version !== item.publishedVersion ||
        row.description !== item.previous ||
        row.published_description !== item.publishedPrevious
      )
        throw new Error(
          "Course changed since the introduction plan was prepared; no changes applied.",
        );
      let publishedVersion = row.published_version;
      if (
        item.publish &&
        publishedVersion !== null &&
        item.introduction !== row.published_description
      ) {
        const next = await client.query<{ version: number }>(
          "select greatest($2::integer, coalesce(max(version),0))+1 as version from course_revisions where course_id=$1",
          [item.id, row.version],
        );
        const version = next.rows[0].version;
        const inserted = await client.query(
          `insert into course_revisions(course_id,version,content)
          select r.course_id,$3,jsonb_set(r.content,'{description}',to_jsonb($4::text))
          from course_revisions r join courses c on c.id=r.course_id
          where r.course_id=$1 and r.version=$2 and c.owner_id=$5`,
          [item.id, publishedVersion, version, item.introduction, item.ownerId],
        );
        if (inserted.rowCount !== 1)
          throw new Error("Publication unavailable; no changes applied.");
        publishedVersion = version;
      }
      const updated = await client.query(
        `update courses set
        draft_content=jsonb_set(draft_content,'{description}',to_jsonb($3::text)),
        draft_revision=draft_revision+1, version=coalesce($4::integer,version),
        published_version=$4, updated_at=now()
        where id=$1 and owner_id=$2 and draft_revision=$5`,
        [
          item.id,
          item.ownerId,
          item.introduction,
          publishedVersion,
          item.draftRevision,
        ],
      );
      if (updated.rowCount !== 1)
        throw new Error("Course changed; no changes applied.");
      results.push({
        id: item.id,
        introduction: item.introduction,
        publishedVersion,
      });
    }
    await client.query("commit");
    return results;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
