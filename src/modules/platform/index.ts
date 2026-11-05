// Public server API. Business modules should import from here, not internal files.
export {
  getCurrentUser,
  getSessionUser,
  getSessionState,
  DEMO_USERS,
} from "./server/identity";
export {
  changeUserRoleAction,
  withdrawCourseAction,
} from "./server/admin-actions";
export {
  getWorkspace,
  getStudentCourseContext,
  getCourseCatalog,
  getOwnedCourseCatalog,
  canDeleteOwnedCourse,
  getPublishedCourse,
  createCourse,
  publishCourse,
  enrollCourse,
  leaveCourse,
  deleteOwnedCourse,
  switchCourseLevel,
  isCourseManagedByClass,
  completeLesson,
  getLearningContext,
  recordSubmission,
  addTeacherFeedback,
  calculateProgress,
  getCourseDocumentForAuthor,
  updateCourseDraft,
  getLearningPath,
  listLearningPaths,
  saveLearningPath,
  listGenerationRecords,
  recordGeneration,
  createMaterial,
  appendMaterialChunk,
  discardMaterialUpload,
  getMaterialForDownload,
  getMaterialsForGeneration,
} from "./server/services";

export {
  platformExtensions,
  getExtensionCapabilities,
} from "./server/extensions";
export type {
  PlatformExtensionRepositories,
  ObjectStoragePort,
  MaterialExtractionPort,
  InvitationMailerPort,
} from "@/shared/database/extension-repositories";
export {
  FeatureServiceError,
  featureFailure,
} from "./server/extensions/errors";
