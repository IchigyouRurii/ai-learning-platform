import type { Pool } from "pg";
import {
  courseDraftSchema,
  courseLevel,
  type CourseLevel,
  catalogCourseSchema,
  toPublishedCourse,
  type Course,
  type CourseDocument,
  type CourseDraft,
  type Enrollment,
  type GenerationKind,
  type LearningPathRecord,
  type Submission,
  type LessonCompletionRecord,
  type TeacherFeedback,
  type User,
} from "@/shared/contracts";
import type { PlatformRepository } from "./repository";

type CourseRow = {
  id: string;
  owner_id: string;
  status: Course["status"];
  visibility: Course["visibility"];
  version: number;
  content: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  moderation_status: "active" | "withdrawn";
  moderation_reason: string;
};
type CourseDocumentRow = {
  id: string;
  owner_id: string;
  status: Course["status"];
  visibility: Course["visibility"];
  version: number;
  published_version: number | null;
  draft_revision: number;
  draft_content: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  moderation_status: "active" | "withdrawn";
  moderation_reason: string;
};
const courseColumns = `c.id, c.owner_id, c.status, c.visibility, c.version, coalesce(r.content, c.draft_content) as content, c.created_at, c.updated_at, c.moderation_status, c.moderation_reason`;
const courseFrom = `courses c left join course_revisions r on r.course_id = c.id and r.version = c.published_version`;
const timestamp = (value: string | Date) => new Date(value).toISOString();
function courseFromRow(row: CourseRow): Course {
  return {
    ...courseDraftSchema.parse(row.content),
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    moderationStatus: row.moderation_status,
    withdrawalReason: row.moderation_reason,
  };
}
function documentFromRow(row: CourseDocumentRow): CourseDocument {
  return {
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    publishedVersion: row.published_version,
    draftRevision: row.draft_revision,
    content: courseDraftSchema.parse(row.draft_content),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    moderationStatus: row.moderation_status,
    withdrawalReason: row.moderation_reason,
  };
}
const documentColumns = `id, owner_id, status, visibility, version, published_version, draft_revision, draft_content, created_at, updated_at, moderation_status, moderation_reason`;

export function createNeonRepository(pool: Pool): PlatformRepository {
  return {
    async listOwnedCatalog(actor) {
      if (!actor?.id || !["teacher", "student"].includes(actor.role))
        throw new Error("An author account is required.");
      const result = await pool.query(
        `select c.id, c.owner_id as "ownerId", $2::text as author,
        coalesce(r.content,c.draft_content)->>'title' as title,
        coalesce(r.content,c.draft_content)->>'description' as description,
        coalesce(r.content,c.draft_content)->>'subject' as subject,
        jsonb_array_length(coalesce(r.content,c.draft_content)->'lessons') as "lessonCount",
        c.version, c.status, c.moderation_status as "moderationStatus"
        from ${courseFrom} where c.owner_id=$1 order by c.created_at desc`,
        [actor.id, actor.name],
      );
      return result.rows.map((row) => catalogCourseSchema.parse(row));
    },
    async canDeleteOwnedCourse(courseId, ownerId) {
      const result = await pool.query(
        `select 1 from courses c join "user" u on u.id=c.owner_id
        where c.id=$1 and c.owner_id=$2 and u.role='student' and c.visibility='personal'
        and not exists(select 1 from classrooms where course_id=c.id)
        and not exists(select 1 from course_assignments where course_id=c.id)
        and not exists(select 1 from enrollments where course_id=c.id and student_id<>$2)`,
        [courseId, ownerId],
      );
      return result.rows.length > 0;
    },
    async listCatalog(actor) {
      if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
        throw new Error("Please sign in first.");
      const result = await pool.query(
        `select c.id, c.owner_id as "ownerId", u.name as author,
          r.content->>'title' as title, r.content->>'description' as description,
          r.content->>'subject' as subject, jsonb_array_length(r.content->'lessons') as "lessonCount",
          c.published_version as version, c.status, c.moderation_status as "moderationStatus"
         from courses c join course_revisions r on r.course_id = c.id and r.version = c.published_version
         join "user" u on u.id = c.owner_id
         where c.status = 'published' and c.visibility = 'cohort' and c.moderation_status = 'active'
         order by c.created_at desc`,
      );
      return result.rows.map((row) => catalogCourseSchema.parse(row));
    },
    async findPublishedCourse(actor, id) {
      if (!actor?.id || !["teacher", "student", "admin"].includes(actor.role))
        throw new Error("Please sign in first.");
      const result = await pool.query<CourseRow & { author: string }>(
        `select c.id, c.owner_id, c.status, c.visibility, c.published_version as version,
          r.content, c.created_at, c.updated_at, c.moderation_status, c.moderation_reason, u.name as author
         from courses c join course_revisions r on r.course_id = c.id and r.version = c.published_version
         join "user" u on u.id = c.owner_id
         where c.id = $1 and c.status = 'published' and c.visibility = 'cohort' and c.moderation_status = 'active'`,
        [id],
      );
      const row = result.rows[0];
      return row ? toPublishedCourse(courseFromRow(row), row.author) : null;
    },
    async getStudentCourseContext(actor, courseId) {
      if (!actor?.id || actor.role !== "student")
        throw new Error("Student access required.");
      const result = await pool.query<
        CourseRow & {
          enrolled: boolean;
          class_managed: boolean;
          active_level: CourseLevel | null;
        }
      >(
        `select ${courseColumns},
          exists(select 1 from enrollments e where e.course_id=c.id and e.student_id=$2 and e.direct_access) as enrolled,
          (select e.difficulty from enrollments e where e.course_id=c.id and e.student_id=$2 and e.direct_access) as active_level,
          exists(select 1 from classrooms cl where cl.course_id=c.id) as class_managed
         from ${courseFrom}
         where c.id=$1 and c.status='published' and c.moderation_status='active'
           and r.course_id is not null
           and (c.visibility='cohort' or (c.visibility='personal' and c.owner_id=$2))
           and exists(select 1 from "user" u where u.id=$2 and u.role='student')`,
        [courseId, actor.id],
      );
      const row = result.rows[0];
      if (!row) return null;
      const course = courseFromRow(row);
      // A prospective learner needs an outline, not unrelated private history.
      if (!row.enrolled)
        return {
          course,
          enrolled: false,
          activeLevel: null,
          classManaged: row.class_managed,
          submissions: [],
          lessonCompletions: [],
        };
      const access = `exists(select 1 from enrollments e join courses c on c.id=e.course_id
        where e.course_id=$1 and e.student_id=$2 and e.direct_access
        and c.status='published' and c.moderation_status='active'
        and (c.visibility='cohort' or (c.visibility='personal' and c.owner_id=$2)))`;
      const [submissions, completions] = await Promise.all([
        pool.query<Submission>(
          `select s.id,s.course_id as "courseId",s.course_version as "courseVersion",s.activity_id as "activityId",s.student_id as "studentId",s.answer,s.ai_feedback as "aiFeedback",s.score,s.max_score as "maxScore",s.created_at as "createdAt", s.difficulty
          from submissions s where s.course_id=$1 and s.student_id=$2 and s.course_version=$3 and s.difficulty=$4 and ${access} order by s.created_at`,
          [courseId, actor.id, course.version, courseLevel(row.active_level)],
        ),
        pool.query<LessonCompletionRecord>(
          `select lc.course_id as "courseId",lc.course_version as "courseVersion",lc.lesson_id as "lessonId",lc.student_id as "studentId",lc.completed_at as "completedAt", lc.difficulty
          from lesson_completions lc where lc.course_id=$1 and lc.student_id=$2 and lc.course_version=$3 and lc.difficulty=$4 and ${access}`,
          [courseId, actor.id, course.version, courseLevel(row.active_level)],
        ),
      ]);
      return {
        course,
        enrolled: true,
        activeLevel: courseLevel(row.active_level),
        classManaged: row.class_managed,
        submissions: submissions.rows.map((item) => ({
          ...item,
          createdAt: timestamp(item.createdAt),
        })),
        lessonCompletions: completions.rows.map((item) => ({
          ...item,
          completedAt: timestamp(item.completedAt),
        })),
      };
    },
    async getWorkspace(actor) {
      const teacher = actor.role === "teacher";
      // These reads are independent and retain the same actor-scoped SQL.
      const [
        courses,
        enrollments,
        submissions,
        feedback,
        members,
        lessonCompletions,
      ] = await Promise.all([
        pool.query<CourseRow>(
          teacher
            ? `select ${courseColumns} from ${courseFrom} where c.owner_id = $1 order by c.created_at desc`
            : `select ${courseColumns} from ${courseFrom} where (c.status = 'published' and c.visibility = 'cohort' and c.moderation_status = 'active') or (c.owner_id = $1 and c.visibility = 'personal') order by c.created_at desc`,
          [actor.id],
        ),
        pool.query<Enrollment>(
          `select e.course_id as "courseId", e.student_id as "studentId", e.joined_at as "joinedAt", e.difficulty from enrollments e join courses c on c.id = e.course_id where ${teacher ? "c.owner_id" : "e.student_id"} = $1 and
          e.direct_access`,
          [actor.id],
        ),
        pool.query<Submission>(
          `select s.id, s.course_id as "courseId", s.course_version as "courseVersion", s.activity_id as "activityId", s.student_id as "studentId", s.answer, s.ai_feedback as "aiFeedback", s.score, s.max_score as "maxScore", s.created_at as "createdAt", s.difficulty from submissions s join courses c on c.id = s.course_id where ${teacher ? "c.owner_id" : "s.student_id"} = $1 order by s.created_at`,
          [actor.id],
        ),
        pool.query<TeacherFeedback>(
          `select f.id, f.course_id as "courseId", f.student_id as "studentId", f.teacher_id as "teacherId", f.message, f.created_at as "createdAt" from teacher_feedback f join courses c on c.id = f.course_id where ${teacher ? "c.owner_id" : "f.student_id"} = $1 order by f.created_at`,
          [actor.id],
        ),
        teacher
          ? pool.query<User>(
              `select distinct u.id, u.name, u.role from "user" u join enrollments e on e.student_id = u.id join courses c on c.id = e.course_id where c.owner_id = $1`,
              [actor.id],
            )
          : Promise.resolve({ rows: [actor] }),
        pool.query<{
          courseId: string;
          courseVersion: number;
          lessonId: string;
          studentId: string;
          completedAt: Date | string;
        }>(
          `select lc.course_id as "courseId", lc.course_version as "courseVersion", lc.lesson_id as "lessonId", lc.student_id as "studentId", lc.completed_at as "completedAt", lc.difficulty
           from lesson_completions lc join courses c on c.id = lc.course_id
           where ${teacher ? "c.owner_id" : "lc.student_id"} = $1
           order by lc.completed_at`,
          [actor.id],
        ),
      ]);
      return {
        schemaVersion: 1 as const,
        courses: courses.rows.map(courseFromRow),
        enrollments: enrollments.rows.map((item) => ({
          ...item,
          joinedAt: timestamp(item.joinedAt),
        })),
        submissions: submissions.rows.map((item) => ({
          ...item,
          createdAt: timestamp(item.createdAt),
        })),
        feedback: feedback.rows.map((item) => ({
          ...item,
          createdAt: timestamp(item.createdAt),
        })),
        lessonCompletions: lessonCompletions.rows.map((item) => ({
          ...item,
          completedAt: timestamp(item.completedAt),
        })),
        members: members.rows,
      };
    },
    async findCourse(id) {
      const result = await pool.query<CourseRow>(
        `select ${courseColumns} from ${courseFrom} where c.id = $1`,
        [id],
      );
      return result.rows[0] ? courseFromRow(result.rows[0]) : null;
    },
    async getCourseDocument(id) {
      const result = await pool.query<CourseDocumentRow>(
        `select ${documentColumns} from courses where id = $1`,
        [id],
      );
      return result.rows[0] ? documentFromRow(result.rows[0]) : null;
    },
    async getActiveCourseLevel(courseId, studentId) {
      const result = await pool.query<{ difficulty: CourseLevel }>(
        `select e.difficulty from enrollments e join courses c on c.id=e.course_id join "user" u on u.id=e.student_id
        where e.course_id=$1 and e.student_id=$2 and e.direct_access and u.role='student' and c.status='published' and c.moderation_status='active'
        and (c.visibility='cohort' or (c.visibility='personal' and c.owner_id=$2))`,
        [courseId, studentId],
      );
      return result.rows[0]?.difficulty ?? null;
    },
    async switchCourseLevel(
      courseId,
      studentId,
      expectedLevel,
      nextLevel,
      courseVersion,
    ) {
      const result = await pool.query(
        `update enrollments e set difficulty=$4 from courses c,course_revisions r,"user" u
        where e.course_id=$1 and e.student_id=$2 and e.difficulty=$3 and e.direct_access
        and c.id=e.course_id and c.status='published' and c.moderation_status='active' and c.published_version=$5
        and (c.visibility='cohort' or (c.visibility='personal' and c.owner_id=$2))
        and r.course_id=c.id and r.version=$5 and u.id=$2 and u.role='student'
        and (not exists(select 1 from jsonb_array_elements(r.content->'lessons') l where l ? 'difficulty')
          or exists(select 1 from jsonb_array_elements(r.content->'lessons') l where coalesce(l->>'difficulty','beginner')=$4)) returning e.course_id`,
        [courseId, studentId, expectedLevel, nextLevel, courseVersion],
      );
      if (!result.rowCount)
        throw new Error(
          "The course or active difficulty has changed. Refresh and try again.",
        );
    },
    async isEnrolled(courseId, studentId) {
      const result = await pool.query(
        `select 1 from enrollments e join courses c on c.id = e.course_id
         join "user" u on u.id = e.student_id and u.role = 'student'
         where e.course_id = $1 and e.student_id = $2 and e.direct_access
         and c.status = 'published' and c.moderation_status = 'active'`,
        [courseId, studentId],
      );
      return Boolean(result.rowCount);
    },
    async deleteOwnedCourse(courseId, ownerId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const owned = await client.query(
          `select c.id from courses c join "user" u on u.id=c.owner_id
          where c.id=$1 and c.owner_id=$2 and u.role='student' and c.visibility='personal' for update of c`,
          [courseId, ownerId],
        );
        if (!owned.rows.length)
          throw new Error("You can only delete courses you created.");
        const used = await client.query(
          `select 1 where
          exists(select 1 from classrooms where course_id=$1) or
          exists(select 1 from course_assignments where course_id=$1) or
          exists(select 1 from enrollments where course_id=$1 and student_id<>$2)`,
          [courseId, ownerId],
        );
        if (used.rows.length)
          throw new Error(
            "This course is linked to a class or another learner. It cannot be deleted because their learning records must be preserved.",
          );
        await client.query("delete from teacher_feedback where course_id=$1", [
          courseId,
        ]);
        await client.query("delete from submissions where course_id=$1", [
          courseId,
        ]);
        // Course revisions, author's enrollment, completions, annotations and discussions cascade.
        const removed = await client.query(
          "delete from courses where id=$1 and owner_id=$2 returning id",
          [courseId, ownerId],
        );
        if (!removed.rows.length)
          throw new Error("The course could not be deleted.");
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async leaveCourse(courseId, studentId) {
      const result = await pool.query(
        `update enrollments e set direct_access = false
         from courses c, "user" u
         where e.course_id=$1 and e.student_id=$2 and c.id=e.course_id
           and u.id=$2 and u.role='student'
           and c.visibility='cohort' and c.owner_id <> $2
           and not exists (select 1 from classrooms cl where cl.course_id=c.id)
         returning e.course_id`,
        [courseId, studentId],
      );
      if (!result.rows.length)
        throw new Error(
          "Unable to leave this course. Class courses cannot be left.",
        );
    },
    async isCourseManagedByClass(courseId) {
      const result = await pool.query(
        "select 1 from classrooms where course_id = $1 limit 1",
        [courseId],
      );
      return Boolean(result.rowCount);
    },
    async insertCourse(course) {
      const {
        title,
        description,
        subject,
        audience,
        goals,
        lessons,
        attachments,
      } = course;
      const content = {
        title,
        description,
        subject,
        audience,
        goals,
        lessons,
        attachments,
      };
      const client = await pool.connect();
      try {
        await client.query("begin");
        const owner = await client.query<{ role: string }>(
          'select role from "user" where id = $1 for share',
          [course.ownerId],
        );
        if (
          owner.rows[0]?.role !==
          (course.visibility === "personal" ? "student" : "teacher")
        )
          throw new Error(
            "This account can no longer create this type of course.",
          );
        // The courses_check constraint requires published_version to be set in
        // the same statement as status='published'. The revision FK is
        // deferrable, so the revision can be inserted immediately afterwards.
        const publishedVersion =
          course.status === "published" ? course.version : null;
        await client.query(
          `insert into courses (id, owner_id, status, visibility, version, published_version, draft_content, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
          [
            course.id,
            course.ownerId,
            course.status,
            course.visibility,
            course.version,
            publishedVersion,
            JSON.stringify(content),
            course.createdAt,
            course.updatedAt,
          ],
        );
        if (course.visibility === "personal" && course.status === "published") {
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [course.id, course.version, JSON.stringify(content)],
          );
          await client.query(
            `insert into enrollments (course_id, student_id) values ($1, $2) on conflict do nothing`,
            [course.id, course.ownerId],
          );
        }
        await client.query("commit");
        return course;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateCourseDraft(
      courseId,
      ownerId,
      expectedDraftRevision,
      content: CourseDraft,
    ) {
      const result = await pool.query<CourseDocumentRow>(
        `update courses set draft_content = $4::jsonb, draft_revision = draft_revision + 1, updated_at = now() where id = $1 and owner_id = $2 and draft_revision = $3 returning ${documentColumns}`,
        [
          courseId,
          ownerId,
          expectedDraftRevision,
          JSON.stringify(courseDraftSchema.parse(content)),
        ],
      );
      if (!result.rows[0])
        throw new Error(
          "This course changed in another tab or does not belong to you. Reload and try again.",
        );
      return documentFromRow(result.rows[0]);
    },
    async publishCourse(courseId, ownerId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query<{
          id: string;
          owner_id: string;
          status: Course["status"];
          visibility: Course["visibility"];
          version: number;
          published_version: number | null;
          draft_content: unknown;
          created_at: Date | string;
          updated_at: Date | string;
        }>(
          `select id, owner_id, status, visibility, version, published_version, draft_content, created_at, updated_at from courses where id = $1 and owner_id = $2 for update`,
          [courseId, ownerId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Course not found or access denied.");
        const content = courseDraftSchema.parse(row.draft_content);
        let unchanged = false;
        if (row.status === "published" && row.published_version !== null) {
          const same = await client.query<{ same: boolean }>(
            `select content = $3::jsonb as same from course_revisions where course_id = $1 and version = $2`,
            [courseId, row.published_version, JSON.stringify(content)],
          );
          unchanged = same.rows[0]?.same === true;
        }
        const version =
          row.status === "published" ? row.version + 1 : row.version;
        if (!unchanged) {
          await client.query(
            "insert into course_revisions (course_id, version, content) values ($1, $2, $3::jsonb)",
            [courseId, version, JSON.stringify(content)],
          );
          await client.query(
            "update courses set status = 'published', version = $2, published_version = $2, updated_at = now() where id = $1 returning updated_at",
            [courseId, version],
          );
        }
        await client.query("commit");
        return {
          ...content,
          id: row.id,
          ownerId: row.owner_id,
          status: "published" as const,
          visibility: row.visibility,
          version: unchanged ? row.version : version,
          createdAt: timestamp(row.created_at),
          updatedAt: new Date().toISOString(),
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async enroll(courseId, studentId, difficulty = "beginner") {
      const result = await pool.query(
        `with available as (select c.id from courses c join course_revisions r on r.course_id=c.id and r.version=c.published_version join "user" u on u.id=$2 and u.role='student'
         where c.id = $1 and c.status = 'published' and c.moderation_status = 'active' and (c.visibility = 'cohort' or (c.visibility = 'personal' and c.owner_id = $2))
         and (not exists(select 1 from jsonb_array_elements(r.content->'lessons') l where l ? 'difficulty') or exists(select 1 from jsonb_array_elements(r.content->'lessons') l where coalesce(l->>'difficulty','beginner')=$3)) for share of c,u)
         insert into enrollments (course_id, student_id, difficulty) select id, $2, $3 from available on conflict (course_id, student_id) do update set direct_access = true, difficulty=excluded.difficulty where not enrollments.direct_access or enrollments.difficulty=excluded.difficulty returning course_id`,
        [courseId, studentId, difficulty],
      );
      if (!result.rowCount)
        throw new Error("This course is not open for enrollment.");
    },
    async insertSubmission(item) {
      const result = await pool.query(
        `with available as (select id, published_version from courses where id = $2 and status = 'published' and moderation_status = 'active' for share),
        student as (select id from "user" where id = $5 and role = 'student' for share),
        direct_grant as (select e.student_id from enrollments e join available c on c.id = e.course_id where e.student_id = $5 and e.direct_access and e.difficulty=$11 and c.published_version = $3 for share of e)
        insert into submissions (id, course_id, course_version, activity_id, student_id, answer, ai_feedback, score, max_score, created_at, difficulty)
        select $1, c.id, r.version, $4, s.id, $6, $7, $8, $9, $10, $11 from available c
        join course_revisions r on r.course_id = c.id and r.version = $3 cross join student s
        where exists(select 1 from direct_grant)
        and exists (select 1 from jsonb_array_elements(r.content->'lessons') l cross join lateral jsonb_array_elements(l->'blocks') b where b->>'type' = 'activity' and b->'activity'->>'id' = $4 and (not exists(select 1 from jsonb_array_elements(r.content->'lessons') any_l where any_l ? 'difficulty') or coalesce(l->>'difficulty','beginner')=$11)) returning id`,
        [
          item.id,
          item.courseId,
          item.courseVersion,
          item.activityId,
          item.studentId,
          item.answer,
          item.aiFeedback,
          item.score ?? null,
          item.maxScore ?? null,
          item.createdAt,
          courseLevel(item.difficulty),
        ],
      );
      if (!result.rowCount)
        throw new Error(
          "The course, activity, or enrollment has changed. Refresh and try again.",
        );
      return item;
    },
    async completeLesson(
      courseId,
      courseVersion,
      lessonId,
      studentId,
      completed = true,
      difficulty = "beginner",
    ) {
      if (!completed) {
        await pool.query(
          `delete from lesson_completions lc
           using courses c, enrollments e
           where lc.course_id = c.id and e.course_id = c.id
             and e.student_id = $4 and e.direct_access and e.difficulty=$5
             and c.status = 'published' and c.moderation_status = 'active'
             and lc.course_id = $1 and lc.course_version = $2
             and lc.lesson_id = $3 and lc.student_id = $4 and lc.difficulty=$5`,
          [courseId, courseVersion, lessonId, studentId, difficulty],
        );
        return;
      }
      const result = await pool.query(
        `insert into lesson_completions (student_id, course_id, course_version, lesson_id, difficulty)
         select $4, c.id, r.version, $3, $5
         from courses c
         join course_revisions r on r.course_id = c.id and r.version = $2
         join enrollments e on e.course_id = c.id and e.student_id = $4 and e.direct_access and e.difficulty=$5
         where c.id = $1 and c.status = 'published' and c.moderation_status = 'active' and c.published_version=$2
           and exists (
             select 1 from jsonb_array_elements(r.content->'lessons') lesson
             where lesson->>'id' = $3 and (not exists(select 1 from jsonb_array_elements(r.content->'lessons') any_l where any_l ? 'difficulty') or coalesce(lesson->>'difficulty','beginner')=$5)
           )
         on conflict (student_id, course_id, course_version, lesson_id, difficulty) do update set completed_at=lesson_completions.completed_at
         returning lesson_id`,
        [courseId, courseVersion, lessonId, studentId, difficulty],
      );
      if (!result.rowCount)
        throw new Error(
          "The course, lesson, or enrollment has changed. Refresh and try again.",
        );
    },
    async insertFeedback(item) {
      const result = await pool.query(
        `insert into teacher_feedback (id, course_id, student_id, teacher_id, message, created_at) select $1, c.id, e.student_id, $4, $5, $6 from courses c join enrollments e on e.course_id = c.id and e.student_id = $3 where c.id = $2 and c.owner_id = $4 and e.direct_access returning id`,
        [
          item.id,
          item.courseId,
          item.studentId,
          item.teacherId,
          item.message,
          item.createdAt,
        ],
      );
      if (!result.rowCount)
        throw new Error("Access denied or student not enrolled.");
    },
    async getLearningPath(ownerId) {
      const stored = await pool.query<{
        id: string;
        owner_id: string;
        title: string;
        steps: LearningPathRecord["steps"];
        created_at: Date | string;
      }>(
        "select id, owner_id, title, steps, created_at from learning_paths where owner_id = $1 order by created_at desc limit 1",
        [ownerId],
      );
      const row = stored.rows[0];
      if (row)
        return {
          id: row.id,
          ownerId: row.owner_id,
          title: row.title,
          steps: row.steps,
          createdAt: timestamp(row.created_at),
          updatedAt: timestamp(row.created_at),
        };
      // Fall back to the single path stored before history was introduced.
      const legacy = await pool.query<{
        learning_path: LearningPathRecord | null;
      }>("select learning_path from learning_profiles where user_id = $1", [
        ownerId,
      ]);
      const path = legacy.rows[0]?.learning_path;
      return path && Object.keys(path).length ? path : null;
    },
    async listLearningPaths(ownerId) {
      const result = await pool.query<{
        id: string;
        owner_id: string;
        title: string;
        steps: LearningPathRecord["steps"];
        created_at: Date | string;
      }>(
        "select id, owner_id, title, steps, created_at from learning_paths where owner_id = $1 order by created_at desc limit 50",
        [ownerId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        steps: row.steps,
        createdAt: timestamp(row.created_at),
        updatedAt: timestamp(row.created_at),
      }));
    },
    async saveLearningPath(path) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const saved = await client.query(
          `insert into learning_paths (id, owner_id, title, steps, created_at)
           select $1, $2, $3, $4::jsonb, $5
           where exists (select 1 from "user" where id = $2 and role = 'student')
             and not exists (
               select 1 from jsonb_array_elements($4::jsonb) step
               where not exists (
                 select 1 from courses c join course_revisions r on r.course_id = c.id and r.version = c.published_version
                 where c.id = step->>'courseId' and c.published_version = (step->>'courseVersion')::int
                   and c.status = 'published' and c.visibility = 'cohort' and c.moderation_status = 'active'
                   and coalesce(step->>'difficulty', 'beginner') in ('beginner', 'advanced', 'expert')
                   and jsonb_array_length(r.content->'lessons') > 0
                   and (
                     not exists (select 1 from jsonb_array_elements(r.content->'lessons') lesson where lesson ? 'difficulty')
                     or exists (select 1 from jsonb_array_elements(r.content->'lessons') lesson where lesson->>'difficulty' = coalesce(step->>'difficulty', 'beginner'))
                   )
               )
             )
           on conflict (id) do update set title = excluded.title, steps = excluded.steps
           where learning_paths.owner_id = excluded.owner_id
           returning id`,
          [
            path.id,
            path.ownerId,
            path.title,
            JSON.stringify(path.steps),
            path.createdAt,
          ],
        );
        if (!saved.rows.length)
          throw new Error(
            "The path or one of its courses is no longer available.",
          );
        await client.query(
          `insert into learning_profiles (user_id, learning_path, updated_at) values ($1, $2::jsonb, now()) on conflict (user_id) do update set learning_path = excluded.learning_path, updated_at = now()`,
          [path.ownerId, JSON.stringify(path)],
        );
        await client.query("commit");
        return path;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async insertGenerationRecord(record) {
      await pool.query(
        "insert into generation_records (id, owner_id, kind, course_id, input, result, created_at) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)",
        [
          record.id,
          record.ownerId,
          record.kind,
          record.courseId,
          JSON.stringify(record.input),
          record.result === null ? null : JSON.stringify(record.result),
          record.createdAt,
        ],
      );
      return record;
    },
    async listGenerationRecords(
      ownerId,
      options: {
        kind?: GenerationKind;
        courseId?: string;
        limit?: number;
      } = {},
    ) {
      const conditions = ["owner_id = $1"];
      const values: unknown[] = [ownerId];
      if (options.kind) {
        values.push(options.kind);
        conditions.push(`kind = $${values.length}`);
      }
      if (options.courseId) {
        values.push(options.courseId);
        conditions.push(`course_id = $${values.length}`);
      }
      values.push(options.limit ?? 20);
      const result = await pool.query<{
        id: string;
        owner_id: string;
        kind: GenerationKind;
        course_id: string | null;
        input: unknown;
        result: unknown;
        created_at: Date | string;
      }>(
        `select id, owner_id, kind, course_id, input, result, created_at from generation_records where ${conditions.join(" and ")} order by created_at desc limit $${values.length}`,
        values,
      );
      return result.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        kind: row.kind,
        courseId: row.course_id,
        input: row.input,
        result: row.result,
        createdAt: timestamp(row.created_at),
      }));
    },
    async appendMaterialChunk(ownerId, input) {
      const query =
        input.offset === 0
          ? `insert into course_material_uploads (id,owner_id,filename,mime_type,total_bytes,content)
           select $1,$2,$3,$4,$5,$7 where $6::int=0
             and exists(select 1 from "user" where id=$2 and role in ('teacher','student'))
             and (select count(*) from course_material_uploads where owner_id=$2 and expires_at>now()) < 5
           on conflict(id) do nothing
           returning case when octet_length(content)=total_bytes then content else null end as content`
          : `update course_material_uploads set content=content || $7
           where id=$1 and owner_id=$2 and filename=$3 and mime_type=$4 and total_bytes=$5
             and octet_length(content)=$6 and expires_at>now()
             and exists(select 1 from "user" where id=$2 and role in ('teacher','student'))
           returning case when octet_length(content)=total_bytes then content else null end as content`;
      const result = await pool.query<{ content: Buffer | null }>(query, [
        input.id,
        ownerId,
        input.filename,
        input.mimeType,
        input.totalBytes,
        input.offset,
        Buffer.from(input.content),
      ]);
      if (!result.rows.length)
        throw new Error(
          "Upload expired, out of order, or too many uploads in progress. Please try again.",
        );
      return result.rows[0].content
        ? new Uint8Array(result.rows[0].content)
        : null;
    },
    async discardMaterialUpload(ownerId, id) {
      await pool.query(
        "delete from course_material_uploads where owner_id=$1 and (id=$2 or expires_at<=now())",
        [ownerId, id],
      );
    },
    async insertMaterial(material, content, uploadId) {
      if (uploadId) {
        const result = await pool.query(
          `insert into course_materials (id,owner_id,filename,mime_type,size_bytes,content,extracted_text,created_at)
          select $1,$2,$3,$4,$5,u.content,$6,$7 from course_material_uploads u
          where u.id=$8 and u.owner_id=$2 and u.filename=$3 and u.mime_type=$4
            and u.total_bytes=$5 and octet_length(u.content)=u.total_bytes and u.expires_at>now()
          returning id`,
          [
            material.id,
            material.ownerId,
            material.filename,
            material.mimeType,
            material.sizeBytes,
            material.extractedText,
            material.createdAt,
            uploadId,
          ],
        );
        if (!result.rows.length)
          throw new Error("The completed upload is no longer available.");
        return material;
      }

      await pool.query(
        `insert into course_materials (id, owner_id, filename, mime_type, size_bytes, content, extracted_text, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          material.id,
          material.ownerId,
          material.filename,
          material.mimeType,
          material.sizeBytes,
          Buffer.from(content),
          material.extractedText,
          material.createdAt,
        ],
      );
      return material;
    },
    async findMaterial(id) {
      const result = await pool.query<{
        id: string;
        owner_id: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        extracted_text: string;
        created_at: Date | string;
        content: Buffer;
      }>(
        `select id, owner_id, filename, mime_type, size_bytes, extracted_text, created_at, content from course_materials where id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        material: {
          id: row.id,
          ownerId: row.owner_id,
          filename: row.filename,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          extractedText: row.extracted_text,
          createdAt: timestamp(row.created_at),
        },
        content: new Uint8Array(row.content),
      };
    },
    async findMaterialsForOwner(ownerId, ids) {
      if (!ids.length) return [];
      const result = await pool.query<{
        id: string;
        owner_id: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        extracted_text: string;
        created_at: Date | string;
      }>(
        `select id, owner_id, filename, mime_type, size_bytes, extracted_text, created_at from course_materials where owner_id = $1 and id = any($2::text[]) order by created_at desc`,
        [ownerId, ids],
      );
      return result.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        extractedText: row.extracted_text,
        createdAt: timestamp(row.created_at),
      }));
    },
    async isMaterialPublished(materialId) {
      const result = await pool.query(
        `select 1 from courses c
         left join course_revisions r on r.course_id = c.id and r.version = c.published_version
         where c.status = 'published' and c.moderation_status = 'active'
           and coalesce(r.content, c.draft_content)->'attachments' @> $1::jsonb
         limit 1`,
        [JSON.stringify([{ materialId }])],
      );
      return Boolean(result.rowCount);
    },
  };
}
