import type { Course, CourseDraft } from "./course";

export type Role = "teacher" | "student" | "admin";
export type User = { id: string; name: string; role: Role };
export type Enrollment = {
  courseId: string;
  studentId: string;
  joinedAt: string;
};
export type Submission = {
  id: string;
  courseId: string;
  courseVersion: number;
  activityId: string;
  studentId: string;
  answer: string;
  aiFeedback: string;
  createdAt: string;
};
export type TeacherFeedback = {
  id: string;
  courseId: string;
  studentId: string;
  teacherId: string;
  message: string;
  createdAt: string;
};
/** Author-facing course record. `content` may contain quiz answer keys. */
export type CourseDocument = {
  id: string;
  ownerId: string;
  status: Course["status"];
  visibility: Course["visibility"];
  version: number;
  publishedVersion: number | null;
  draftRevision: number;
  content: CourseDraft;
  createdAt: string;
  updatedAt: string;
};
export type LearningPathStep = {
  courseId: string;
  courseVersion: number;
  order: number;
  targetMinutes: number;
  reason: string;
};
export type LearningPathRecord = {
  id: string;
  ownerId: string;
  title: string;
  steps: LearningPathStep[];
  createdAt: string;
  updatedAt: string;
};
export type GenerationKind = "course" | "rewrite" | "path";
/** One persisted AI interaction: generation, rewrite or path plan. */
export type GenerationRecord = {
  id: string;
  ownerId: string;
  kind: GenerationKind;
  courseId: string | null;
  input: unknown;
  result: unknown;
  createdAt: string;
};
export type DemoState = {
  schemaVersion: 1;
  courses: Course[];
  enrollments: Enrollment[];
  submissions: Submission[];
  feedback: TeacherFeedback[];
  learningPaths?: LearningPathRecord[];
  generationRecords?: GenerationRecord[];
};
export type Workspace = DemoState & { members: User[] };
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };
