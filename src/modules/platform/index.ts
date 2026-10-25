// Public server API. Business modules should import from here, not internal files.
export { getCurrentUser, getSessionUser, DEMO_USERS } from "./server/identity";
export {
  getWorkspace,
  createCourse,
  publishCourse,
  enrollCourse,
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
