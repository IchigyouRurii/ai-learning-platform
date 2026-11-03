import type { Course, CourseDraft, CourseLevel } from "./course";

export type Role = "teacher" | "student" | "admin";
export type User = { id: string; name: string; role: Role };
export type Enrollment = {
  difficulty?: CourseLevel;
  courseId: string;
  studentId: string;
  joinedAt: string;
};
export type Submission = {
  difficulty?: CourseLevel;
  id: string;
  courseId: string;
  courseVersion: number;
  activityId: string;
  studentId: string;
  answer: string;
  aiFeedback: string;
  score?: number | null;
  maxScore?: number | null;
  createdAt: string;
};
export type LessonCompletionRecord = {
  difficulty?: CourseLevel;
  courseId: string;
  courseVersion: number;
  lessonId: string;
  studentId: string;
  completedAt: string;
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
  moderationStatus?: "active" | "withdrawn";
  withdrawalReason?: string;
};
export type LearningPathStep = {
  difficulty?: CourseLevel;
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
export type GenerationKind = "course" | "rewrite" | "path" | "lesson";
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
export type CourseMaterial = {
  id: string;
  ownerId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  createdAt: string;
};
/** Local demo storage only; the Neon adapter keeps bytes in bytea. */
export type DemoMaterial = {
  material: CourseMaterial;
  contentBase64: string;
};
export type DemoState = {
  schemaVersion: 1;
  courses: Course[];
  enrollments: Enrollment[];
  submissions: Submission[];
  feedback: TeacherFeedback[];
  lessonCompletions?: LessonCompletionRecord[];
  learningPaths?: LearningPathRecord[];
  generationRecords?: GenerationRecord[];
  materials?: DemoMaterial[];
};
export type Workspace = DemoState & { members: User[] };
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

/** Server-only detail context: one visible published course and the actor's records. */
export type StudentCourseContext = {
  activeLevel: CourseLevel | null;
  course: Course;
  enrolled: boolean;
  classManaged: boolean;
  submissions: Submission[];
  lessonCompletions: LessonCompletionRecord[];
};
