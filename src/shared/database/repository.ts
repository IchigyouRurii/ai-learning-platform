import type {
  Course,
  DemoState,
  Submission,
  TeacherFeedback,
  User,
  Workspace,
} from "@/shared/contracts";

// State store is used only by local demo data, never by the Neon adapter.
export interface Repository {
  read(): Promise<DemoState>;
  mutate<T>(operation: (state: DemoState) => T): Promise<T>;
}

export interface PlatformRepository {
  getWorkspace(actor: User): Promise<Workspace>;
  findCourse(id: string): Promise<Course | null>;
  isEnrolled(courseId: string, studentId: string): Promise<boolean>;
  insertCourse(course: Course): Promise<Course>;
  publishCourse(courseId: string, ownerId: string): Promise<Course>;
  enroll(courseId: string, studentId: string): Promise<void>;
  insertSubmission(submission: Submission): Promise<Submission>;
  insertFeedback(feedback: TeacherFeedback): Promise<void>;
}
