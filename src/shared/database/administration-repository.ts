import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type {
  AdminCourseEntry,
  AdminOverview,
  FeatureErrorCode,
  ModerationRecord,
  Role,
  User,
  UserDirectoryEntry,
} from "@/shared/contracts";
import type { AdministrationRepository, Page } from "./extension-repositories";

export class AdministrationError extends Error {
  constructor(
    public readonly code: FeatureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdministrationError";
  }
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: Date | string;
};
const userColumns = `id, name, email, role, "emailVerified", "createdAt"`;
const time = (value: Date | string) => new Date(value).toISOString();
const userView = (row: UserRow): UserDirectoryEntry => ({
  ...row,
  createdAt: time(row.createdAt),
});
const cursorSchema = z.strictObject({
  at: z.iso.datetime(),
  id: z.string().min(1).max(200),
});
function cursorParts(cursor?: string) {
  if (!cursor) return null;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
  } catch {
    throw new AdministrationError(
      "INVALID_INPUT",
      "This page link has expired or is invalid. Return to the first page.",
    );
  }
}
function pageOf<T extends { id: string; createdAt: string }>(
  rows: T[],
  limit: number,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ at: last.createdAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

export function createAdministrationRepository(
  pool: Pool,
): AdministrationRepository {
  async function transact<T>(
    actor: User,
    task: (client: PoolClient) => Promise<T>,
    roleChange = false,
  ) {
    if (actor.role !== "admin")
      throw new AdministrationError(
        "FORBIDDEN",
        "Administrator access is required.",
      );
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Role changes are rare. Serialize them (including concurrent removals of
      // different admins) and cooperate with ordinary SQL role updates.
      if (roleChange)
        await client.query('lock table "user" in share row exclusive mode');
      const current = await client.query<{ role: Role }>(
        'select role from "user" where id = $1 for share',
        [actor.id],
      );
      if (current.rows[0]?.role !== "admin")
        throw new AdministrationError(
          "FORBIDDEN",
          "Administrator access is no longer available. Sign in again.",
        );
      const result = await task(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    getOverview: (actor) =>
      transact(actor, async (client) => {
        const users = await client.query<
          Pick<AdminOverview, "users" | "students" | "teachers" | "admins">
        >(
          `select count(*)::int as users,
          count(*) filter (where role = 'student')::int as students,
          count(*) filter (where role = 'teacher')::int as teachers,
          count(*) filter (where role = 'admin')::int as admins from "user"`,
        );
        const courses = await client.query<
          Pick<
            AdminOverview,
            "courses" | "publishedCourses" | "withdrawnCourses"
          >
        >(
          `select count(*)::int as courses,
          count(*) filter (where status = 'published' and moderation_status = 'active')::int as "publishedCourses",
          count(*) filter (where moderation_status = 'withdrawn')::int as "withdrawnCourses"
         from courses where visibility = 'cohort'`,
        );
        return { ...users.rows[0], ...courses.rows[0] };
      }),
    listUsers: (actor, page) =>
      transact(actor, async (client) => {
        const values: unknown[] = [];
        const where = ["true"];
        if (page.search?.trim()) {
          values.push(pattern(page.search.trim()));
          where.push(
            `(name ilike $${values.length} or email ilike $${values.length})`,
          );
        }
        if (page.role) {
          values.push(page.role);
          where.push(`role = $${values.length}`);
        }
        const cursor = cursorParts(page.cursor);
        if (cursor) {
          values.push(cursor.id);
          // Resolve the timestamp in SQL to retain PostgreSQL's microseconds.
          where.push(
            `("createdAt", id) < (select "createdAt", id from "user" where id = $${values.length})`,
          );
        }
        values.push(page.limit + 1);
        const result = await client.query<UserRow>(
          `select ${userColumns} from "user" where ${where.join(" and ")}
         order by "createdAt" desc, id desc limit $${values.length}`,
          values,
        );
        return pageOf(result.rows.map(userView), page.limit);
      }),
    changeRoleAndRevokeSessions: (actor, userId, expectedRole, role) =>
      transact(
        actor,
        async (client) => {
          const result = await client.query<UserRow>(
            `select ${userColumns} from "user" where id = $1 for update`,
            [userId],
          );
          const user = result.rows[0];
          if (!user)
            throw new AdministrationError(
              "NOT_FOUND",
              "This user no longer exists.",
            );
          if (user.role !== expectedRole)
            throw new AdministrationError(
              "CONFLICT",
              "This user's role changed. Refresh the list before trying again.",
            );
          if (role === user.role) return userView(user);
          if (user.role === "admin" && role !== "admin") {
            const admins = await client.query<{ count: number }>(
              "select count(*)::int as count from \"user\" where role = 'admin'",
            );
            if (admins.rows[0].count <= 1)
              throw new AdministrationError(
                "CONFLICT",
                "The last administrator must keep administrator access.",
              );
          }
          const owned = await client.query<{ found: boolean }>(
            `select exists(select 1 from courses where owner_id = $1 and
          ((visibility = 'cohort' and $2 <> 'teacher') or (visibility = 'personal' and $2 <> 'student'))) as found`,
            [userId, role],
          );
          if (owned.rows[0].found)
            throw new AdministrationError(
              "CONFLICT",
              "This user owns courses that require their current role. Resolve course ownership before changing the role.",
            );
          // Classrooms are implemented by a separate domain. Once its table is
          // present, preserve teacher ownership rather than silently orphaning it.
          if (user.role === "teacher" && role !== "teacher") {
            const table = await client.query<{ present: boolean }>(
              "select to_regclass('public.classrooms') is not null as present",
            );
            if (table.rows[0].present) {
              const classes = await client.query(
                "select 1 from classrooms where teacher_id = $1 limit 1",
                [userId],
              );
              if (classes.rowCount)
                throw new AdministrationError(
                  "CONFLICT",
                  "This teacher owns classrooms. Resolve classroom ownership before changing the role.",
                );
            }
          }
          const updated = await client.query<UserRow>(
            `update "user" set role = $2, "updatedAt" = now() where id = $1 and role = $3 returning ${userColumns}`,
            [userId, role, expectedRole],
          );
          await client.query('delete from "session" where "userId" = $1', [
            userId,
          ]);
          await client.query(
            `insert into admin_audit_events (id, admin_id, action, target_id, summary)
         values ($1, $2, 'user.role_changed', $3, $4::jsonb)`,
            [
              randomUUID(),
              actor.id,
              userId,
              JSON.stringify({ from: expectedRole, to: role }),
            ],
          );
          return userView(updated.rows[0]);
        },
        true,
      ),
    listCourses: (actor, page) =>
      transact(actor, async (client) => {
        const values: unknown[] = [];
        const where = ["c.visibility = 'cohort'"];
        const content = "coalesce(r.content, c.draft_content)";
        if (page.search?.trim()) {
          values.push(pattern(page.search.trim()));
          where.push(
            `(${content}->>'title' ilike $${values.length} or ${content}->>'subject' ilike $${values.length} or u.name ilike $${values.length})`,
          );
        }
        if (page.moderationStatus) {
          values.push(page.moderationStatus);
          where.push(`c.moderation_status = $${values.length}`);
        }
        const cursor = cursorParts(page.cursor);
        if (cursor) {
          values.push(cursor.id);
          where.push(
            `(c.created_at, c.id) < (select created_at, id from courses where id = $${values.length} and visibility = 'cohort')`,
          );
        }
        values.push(page.limit + 1);
        const result = await client.query<
          Omit<AdminCourseEntry, "createdAt"> & { createdAt: Date | string }
        >(
          `select c.id, c.owner_id as "ownerId", u.name as "ownerName", c.status, c.visibility,
          c.published_version as "publishedVersion", c.moderation_status as "moderationStatus",
          c.moderation_reason as "moderationReason", c.created_at as "createdAt",
          ${content}->>'title' as title, ${content}->>'description' as description,
          ${content}->>'subject' as subject, ${content}->'goals' as goals,
          coalesce((select jsonb_agg(jsonb_build_object('id', lesson->>'id', 'title', lesson->>'title') order by position)
            from jsonb_array_elements(${content}->'lessons') with ordinality as chapters(lesson, position)), '[]'::jsonb) as chapters
         from courses c join "user" u on u.id = c.owner_id
         left join course_revisions r on r.course_id = c.id and r.version = c.published_version
         where ${where.join(" and ")} order by c.created_at desc, c.id desc limit $${values.length}`,
          values,
        );
        return pageOf(
          result.rows.map((row) => ({
            ...row,
            createdAt: time(row.createdAt),
          })),
          page.limit,
        );
      }),
    withdrawCourseAndAudit: (actor, courseId, reason) =>
      transact(actor, async (client) => {
        const result = await client.query<{
          visibility: string;
          moderation_status: string;
          moderation_reason: string;
          moderated_by: string | null;
          moderated_at: Date | string | null;
        }>(
          `select visibility, moderation_status, moderation_reason, moderated_by, moderated_at
         from courses where id = $1 for update`,
          [courseId],
        );
        const course = result.rows[0];
        if (!course || course.visibility !== "cohort")
          throw new AdministrationError(
            "NOT_FOUND",
            "This teaching course no longer exists.",
          );
        if (course.moderation_status === "withdrawn")
          return {
            courseId,
            status: "withdrawn",
            reason: course.moderation_reason,
            adminId: course.moderated_by!,
            updatedAt: time(course.moderated_at!),
          } satisfies ModerationRecord;
        const updated = await client.query<{ moderated_at: Date | string }>(
          `update courses set moderation_status = 'withdrawn', moderation_reason = $2,
         moderated_by = $3, moderated_at = now(), updated_at = now()
         where id = $1 and visibility = 'cohort' returning moderated_at`,
          [courseId, reason, actor.id],
        );
        await client.query(
          `insert into admin_audit_events (id, admin_id, action, target_id, summary)
         values ($1, $2, 'course.withdrawn', $3, $4::jsonb)`,
          [randomUUID(), actor.id, courseId, JSON.stringify({ reason })],
        );
        return {
          courseId,
          status: "withdrawn",
          reason,
          adminId: actor.id,
          updatedAt: time(updated.rows[0].moderated_at),
        };
      }),
    // Personal-profile operations remain reserved at the service boundary.
    async getOwnProfile() {
      throw new AdministrationError(
        "NOT_IMPLEMENTED",
        "Profile editing is not implemented yet.",
      );
    },
    async updateOwnName() {
      throw new AdministrationError(
        "NOT_IMPLEMENTED",
        "Profile editing is not implemented yet.",
      );
    },
  };
}
