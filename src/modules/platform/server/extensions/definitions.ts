import {
  accountProfileFeatures,
  administrationFeatures,
  annotationFeatures,
  classroomFeatures,
  courseManagementFeatures,
  discussionFeatures,
  generationFeatures,
  learningFeatures,
  learningPathFeatures,
  materialFeatures,
  profileFeatures,
} from "@/shared/contracts/features";

export const extensionDefinitions = {
  annotations: annotationFeatures,
  classrooms: classroomFeatures,
  courseManagement: courseManagementFeatures,
  generation: generationFeatures,
  learning: learningFeatures,
  learningProfiles: profileFeatures,
  learningPaths: learningPathFeatures,
  materials: materialFeatures,
  discussions: discussionFeatures,
  administration: administrationFeatures,
  accountProfiles: accountProfileFeatures,
} as const;
