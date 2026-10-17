import type { Course } from "./course";

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
export type DemoState = {
  schemaVersion: 1;
  courses: Course[];
  enrollments: Enrollment[];
  submissions: Submission[];
  feedback: TeacherFeedback[];
};
export type Workspace = DemoState & { members: User[] };
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };
