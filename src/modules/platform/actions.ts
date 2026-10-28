// Client-safe public entry point. Do not import the server-service barrel into
// client components; Next.js exposes only these Server Actions to the browser.
export {
  changeUserRoleAction,
  withdrawCourseAction,
  setClassroomStatusAction,
  adminRemoveClassroomMemberAction,
  adminRemoveClassroomAssignmentAction,
} from "./server/admin-actions";
export {
  createClassroomAction,
  updateClassroomAction,
  createClassJoinCodeAction,
  importClassStudentsAction,
  removeClassMemberAction,
  assignClassCourseAction,
  removeClassAssignmentAction,
  joinClassroomAction,
} from "./server/classroom-actions";
