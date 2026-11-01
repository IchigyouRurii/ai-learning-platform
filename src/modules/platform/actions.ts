// Client-safe public entry point. Server services stay on the server.
export {
  changeUserRoleAction,
  withdrawCourseAction,
} from "./server/admin-actions";

export { deleteOwnedCourseAction } from "./server/course-actions";
