import type {
  ActivityAttempt,
  AdminOverview,
  AdminClassroomEntry,
  AdminClassroomDetail,
  AdminCourseEntry,
  ActivityResponse,
  AuthoringDraft,
  Classroom,
  AssignableCourse,
  ClassroomInvitation,
  ClassroomMember,
  CourseAssignment,
  CourseEditor,
  CourseQuestion,
  CourseSummary,
  GenerationJob,
  LearningMaterial,
  LearningPath,
  LearningProfile,
  LearningProgress,
  LessonCompletion,
  ModerationRecord,
  PublishedRevision,
  QuestionReply,
  QuestionThread,
  RoleplaySession,
  UserDirectoryEntry,
  GenerationRequest,
  Role,
  User,
} from "@/shared/contracts";
import type { z } from "zod";
import type { pageInputSchema } from "@/shared/contracts/features/common";

export type PageInput = z.output<typeof pageInputSchema>;
export type Page<T> = { items: T[]; nextCursor: string | null };
export type CourseVersionRef = { courseId: string; courseVersion: number };

// Domain ports: administration/classrooms have Neon implementations; other
// adapters remain reserved. Every query
// is actor-scoped; writes must repeat resource and version predicates atomically.
// Public services handle input parsing/AI orchestration. These ports are only
// called from trusted server modules after deriving actor from the session.
export interface ClassroomRepository {
  create(
    actor: User,
    input: { name: string; description: string },
  ): Promise<Classroom>;
  findForActor(actor: User, classId: string): Promise<Classroom | null>;
  update(
    actor: User,
    input: { classId: string; name: string; description: string },
  ): Promise<Classroom>;
  listAssignableCourses(
    actor: User,
    classId: string,
  ): Promise<AssignableCourse[]>;
  removeAssignment(
    actor: User,
    classId: string,
    assignmentId: string,
  ): Promise<boolean>;
  listMine(actor: User, page: PageInput): Promise<Page<Classroom>>;
  listMembers(actor: User, classId: string): Promise<ClassroomMember[]>;
  insertInvitations(
    actor: User,
    classId: string,
    records: { email: string; tokenHash: string; expiresAt: string }[],
  ): Promise<ClassroomInvitation[]>;
  consumeInvitation(actor: User, tokenHash: string): Promise<Classroom>;
  saveJoinCode(
    actor: User,
    classId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void>;
  joinByCodeHash(actor: User, tokenHash: string): Promise<Classroom>;
  importExistingStudents(
    actor: User,
    classId: string,
    emails: string[],
  ): Promise<{ added: string[]; missingEmails: string[] }>;
  removeMember(
    actor: User,
    classId: string,
    studentId: string,
  ): Promise<boolean>;
  assignCourse(
    actor: User,
    input: CourseVersionRef & { classId: string; dueAt?: string },
  ): Promise<CourseAssignment>;
  listAssignments(
    actor: User,
    page: PageInput & { classId?: string },
  ): Promise<Page<CourseAssignment>>;
}

export interface CourseAuthoringRepository {
  listCatalog(
    actor: User,
    page: PageInput & { search?: string; subject?: string },
  ): Promise<Page<CourseSummary>>;
  listMine(actor: User, page: PageInput): Promise<Page<CourseSummary>>;
  getEditor(actor: User, courseId: string): Promise<CourseEditor | null>;
  createPersonal(actor: User, content: AuthoringDraft): Promise<CourseEditor>;
  updateDraft(
    actor: User,
    courseId: string,
    expectedDraftRevision: number,
    content: AuthoringDraft,
  ): Promise<CourseEditor>;
  publishRevision(
    actor: User,
    courseId: string,
    expectedDraftRevision: number,
  ): Promise<{ courseId: string; version: number }>;
  listRevisions(
    actor: User,
    courseId: string,
    page: PageInput,
  ): Promise<Page<Omit<PublishedRevision, "content">>>;
  getRevisionForAuthor(
    actor: User,
    courseId: string,
    version: number,
  ): Promise<PublishedRevision | null>;
  assertLearningAccess(actor: User, reference: CourseVersionRef): Promise<void>;
}

export interface LearningRepository {
  getLearnerCourse(
    actor: User,
    reference: CourseVersionRef,
  ): Promise<import("@/shared/contracts").LearnerCourse | null>;
  getLearnerActivity(
    actor: User,
    reference: CourseVersionRef & { activityId: string },
  ): Promise<import("@/shared/contracts").LearnerActivity>;
  getAuthoringActivityForEvaluation(
    actor: User,
    reference: CourseVersionRef & { activityId: string },
  ): Promise<import("@/shared/contracts").AuthoringActivity>;
  completeLesson(
    actor: User,
    reference: CourseVersionRef & { lessonId: string },
  ): Promise<LessonCompletion>;
  recordEvaluatedAttempt(
    actor: User,
    input: CourseVersionRef & {
      activityId: string;
      idempotencyKey: string;
      response: ActivityResponse;
      feedback: string;
      score: number | null;
      maxScore: number | null;
    },
  ): Promise<ActivityAttempt>;
  listMyAttempts(
    actor: User,
    reference: CourseVersionRef & PageInput & { activityId?: string },
  ): Promise<Page<ActivityAttempt>>;
  listStudentAttempts(
    actor: User,
    reference: CourseVersionRef &
      PageInput & { classId: string; studentId: string; activityId?: string },
  ): Promise<Page<ActivityAttempt>>;
  getMyProgress(
    actor: User,
    reference: CourseVersionRef,
  ): Promise<LearningProgress>;
  getStudentProgress(
    actor: User,
    reference: CourseVersionRef & { classId: string; studentId: string },
  ): Promise<LearningProgress>;
  getClassProgress(
    actor: User,
    classId: string,
    assignmentId: string,
    page: PageInput,
  ): Promise<Page<LearningProgress>>;
  startRoleplay(
    actor: User,
    reference: CourseVersionRef & { activityId: string },
  ): Promise<RoleplaySession>;
  findRoleplay(actor: User, sessionId: string): Promise<RoleplaySession | null>;
  appendRoleplayTurn(
    actor: User,
    sessionId: string,
    expectedTurnCount: number,
    idempotencyKey: string,
    studentMessage: string,
    assistantMessage: string,
  ): Promise<RoleplaySession>;
  finishRoleplay(
    actor: User,
    sessionId: string,
    feedback: string,
  ): Promise<RoleplaySession>;
}

export interface LearningPlanRepository {
  getProfile(actor: User): Promise<LearningProfile | null>;
  saveProfile(
    actor: User,
    input: Omit<LearningProfile, "userId" | "updatedAt">,
  ): Promise<LearningProfile>;
  listMine(actor: User, page: PageInput): Promise<Page<LearningPath>>;
  getMine(actor: User, pathId: string): Promise<LearningPath | null>;
  insertPath(
    actor: User,
    input: Omit<LearningPath, "id" | "ownerId" | "createdAt">,
  ): Promise<LearningPath>;
}

export interface DiscussionRepository {
  insertQuestion(
    actor: User,
    input: CourseVersionRef & { lessonId?: string; message: string },
  ): Promise<CourseQuestion | null>;
  listThreads(
    actor: User,
    courseId: string,
    page: PageInput,
    studentId?: string,
  ): Promise<Page<CourseQuestion> | null>;
  getThread(actor: User, questionId: string): Promise<QuestionThread | null>;
  insertReply(
    actor: User,
    questionId: string,
    message: string,
  ): Promise<QuestionReply | null>;
  resolve(actor: User, questionId: string): Promise<CourseQuestion | null>;
}

export type StoredMaterial = LearningMaterial & {
  objectKey: string;
  extractedText: string | null;
};
export interface MaterialRepository {
  insertPending(
    actor: User,
    input: {
      filename: string;
      contentType: string;
      sizeBytes: number;
      objectKey: string;
    },
  ): Promise<StoredMaterial>;
  findOwned(actor: User, materialId: string): Promise<StoredMaterial | null>;
  listMine(actor: User, page: PageInput): Promise<Page<LearningMaterial>>;
  setProcessingResult(
    actor: User,
    materialId: string,
    status: "processing" | "ready" | "failed",
    extractedText: string | null,
  ): Promise<LearningMaterial>;
}

export interface AdministrationRepository {
  getOverview(actor: User): Promise<AdminOverview>;
  listClassrooms(
    actor: User,
    page: PageInput & { search?: string; status?: "active" | "archived" },
  ): Promise<Page<AdminClassroomEntry>>;
  getClassroom(actor: User, classId: string): Promise<AdminClassroomDetail>;
  setClassroomStatus(
    actor: User,
    input: {
      classId: string;
      expectedStatus: "active" | "archived";
      status: "active" | "archived";
      reason: string;
    },
  ): Promise<AdminClassroomEntry>;
  removeClassroomMember(
    actor: User,
    input: { classId: string; studentId: string; reason: string },
  ): Promise<boolean>;
  removeClassroomAssignment(
    actor: User,
    input: { classId: string; assignmentId: string; reason: string },
  ): Promise<boolean>;
  listUsers(
    actor: User,
    page: PageInput & { search?: string; role?: Role },
  ): Promise<Page<UserDirectoryEntry>>;
  changeRoleAndRevokeSessions(
    actor: User,
    userId: string,
    expectedRole: Role,
    role: Role,
  ): Promise<UserDirectoryEntry>;
  listCourses(
    actor: User,
    page: PageInput & {
      search?: string;
      moderationStatus?: "active" | "withdrawn";
    },
  ): Promise<Page<AdminCourseEntry>>;
  withdrawCourseAndAudit(
    actor: User,
    courseId: string,
    reason: string,
  ): Promise<ModerationRecord>;
  getOwnProfile(
    actor: User,
  ): Promise<
    Pick<UserDirectoryEntry, "id" | "name" | "email" | "role" | "emailVerified">
  >;
  updateOwnName(actor: User, name: string): Promise<Pick<User, "id" | "name">>;
}

export interface GenerationJobRepository {
  insertOwned(
    actor: User,
    input: { kind: "course"; input: GenerationRequest },
  ): Promise<GenerationJob>;
  findOwned(actor: User, jobId: string): Promise<GenerationJob | null>;
  // Worker authentication is separate from an end-user role. The worker writes
  // through a trusted adapter with a claim/lease, never a public Server Action.
  claimPending(
    workerId: string,
  ): Promise<{ job: GenerationJob; leaseToken: string } | null>;
  completeClaim(
    jobId: string,
    leaseToken: string,
    result: AuthoringDraft,
  ): Promise<void>;
  failClaim(
    jobId: string,
    leaseToken: string,
    safeMessage: string,
  ): Promise<void>;
}

export interface ObjectStoragePort {
  issueUpload(input: {
    objectKey: string;
    contentType: string;
    maxBytes: number;
  }): Promise<{
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  }>;
  inspectObject(
    objectKey: string,
  ): Promise<{ sizeBytes: number; contentType: string } | null>;
  issueReadUrl(objectKey: string): Promise<{ url: string; expiresAt: string }>;
}

export interface MaterialExtractionPort {
  extract(input: {
    contentType: string;
    bytes: Uint8Array;
  }): Promise<{ text: string }>;
}

export interface InvitationMailerPort {
  sendInvitation(input: {
    to: string;
    className: string;
    acceptUrl: string;
  }): Promise<{ messageId: string }>;
}

export interface PlatformExtensionRepositories {
  classrooms: ClassroomRepository;
  courses: CourseAuthoringRepository;
  learning: LearningRepository;
  plans: LearningPlanRepository;
  discussions: DiscussionRepository;
  materials: MaterialRepository;
  administration: AdministrationRepository;
  generationJobs: GenerationJobRepository;
}
