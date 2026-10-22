import type {
  Course,
  CourseDocument,
  CourseDraft,
  DemoState,
  LearningPathRecord,
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
  getCourseDocument(id: string): Promise<CourseDocument | null>;
  isEnrolled(courseId: string, studentId: string): Promise<boolean>;
  insertCourse(course: Course): Promise<Course>;
  updateCourseDraft(
    courseId: string,
    ownerId: string,
    expectedDraftRevision: number,
    content: CourseDraft,
  ): Promise<CourseDocument>;
  publishCourse(courseId: string, ownerId: string): Promise<Course>;
  enroll(courseId: string, studentId: string): Promise<void>;
  insertSubmission(submission: Submission): Promise<Submission>;
  insertFeedback(feedback: TeacherFeedback): Promise<void>;
  getLearningPath(ownerId: string): Promise<LearningPathRecord | null>;
  saveLearningPath(path: LearningPathRecord): Promise<LearningPathRecord>;
}
