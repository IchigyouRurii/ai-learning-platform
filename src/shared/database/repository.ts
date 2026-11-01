import type {
  Course,
  CourseLevel,
  CatalogCourse,
  PublishedCourse,
  CourseDocument,
  CourseDraft,
  DemoState,
  GenerationKind,
  GenerationRecord,
  LearningPathRecord,
  Submission,
  TeacherFeedback,
  User,
  Workspace,
  StudentCourseContext,
} from "@/shared/contracts";

// State store is used only by local demo data, never by the Neon adapter.
export interface Repository {
  read(): Promise<DemoState>;
  mutate<T>(operation: (state: DemoState) => T): Promise<T>;
}

export interface PlatformRepository {
  getWorkspace(actor: User): Promise<Workspace>;
  getStudentCourseContext(
    actor: User,
    courseId: string,
  ): Promise<StudentCourseContext | null>;
  listOwnedCatalog(actor: User): Promise<CatalogCourse[]>;
  canDeleteOwnedCourse(courseId: string, ownerId: string): Promise<boolean>;
  listCatalog(actor: User): Promise<CatalogCourse[]>;
  findPublishedCourse(actor: User, id: string): Promise<PublishedCourse | null>;
  findCourse(id: string): Promise<Course | null>;
  getCourseDocument(id: string): Promise<CourseDocument | null>;
  getActiveCourseLevel(
    courseId: string,
    studentId: string,
  ): Promise<CourseLevel | null>;
  switchCourseLevel(
    courseId: string,
    studentId: string,
    expectedLevel: CourseLevel,
    nextLevel: CourseLevel,
    courseVersion: number,
  ): Promise<void>;
  deleteOwnedCourse(courseId: string, ownerId: string): Promise<void>;
  leaveCourse(courseId: string, studentId: string): Promise<void>;
  isEnrolled(courseId: string, studentId: string): Promise<boolean>;
  isCourseManagedByClass(courseId: string): Promise<boolean>;
  insertCourse(course: Course): Promise<Course>;
  updateCourseDraft(
    courseId: string,
    ownerId: string,
    expectedDraftRevision: number,
    content: CourseDraft,
  ): Promise<CourseDocument>;
  publishCourse(courseId: string, ownerId: string): Promise<Course>;
  enroll(
    courseId: string,
    studentId: string,
    difficulty?: CourseLevel,
  ): Promise<void>;
  completeLesson(
    courseId: string,
    courseVersion: number,
    lessonId: string,
    studentId: string,
    completed?: boolean,
    difficulty?: CourseLevel,
  ): Promise<void>;
  insertSubmission(submission: Submission): Promise<Submission>;
  insertFeedback(feedback: TeacherFeedback): Promise<void>;
  getLearningPath(ownerId: string): Promise<LearningPathRecord | null>;
  listLearningPaths(ownerId: string): Promise<LearningPathRecord[]>;
  saveLearningPath(path: LearningPathRecord): Promise<LearningPathRecord>;
  insertGenerationRecord(record: GenerationRecord): Promise<GenerationRecord>;
  listGenerationRecords(
    ownerId: string,
    options?: { kind?: GenerationKind; courseId?: string; limit?: number },
  ): Promise<GenerationRecord[]>;
}
