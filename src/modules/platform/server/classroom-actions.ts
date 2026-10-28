"use server";
import { revalidatePath } from "next/cache";
import type { FeatureInput, classroomFeatures } from "@/shared/contracts";
import { getCurrentUser } from "./identity";
import { classrooms } from "./extensions/classrooms";
function refresh() {
  revalidatePath("/teacher", "layout");
  revalidatePath("/student", "layout");
}
export async function createClassroomAction(
  input: FeatureInput<typeof classroomFeatures.create>,
) {
  const result = await classrooms.create(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
export async function updateClassroomAction(
  input: FeatureInput<typeof classroomFeatures.update>,
) {
  const result = await classrooms.update(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
export async function createClassJoinCodeAction(
  input: FeatureInput<typeof classroomFeatures.createJoinCode>,
) {
  return classrooms.createJoinCode(await getCurrentUser(), input);
}
export async function importClassStudentsAction(
  input: FeatureInput<typeof classroomFeatures.importStudents>,
) {
  const result = await classrooms.importStudents(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
export async function removeClassMemberAction(
  input: FeatureInput<typeof classroomFeatures.removeMember>,
) {
  const result = await classrooms.removeMember(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
export async function assignClassCourseAction(
  input: FeatureInput<typeof classroomFeatures.assignCourse>,
) {
  const result = await classrooms.assignCourse(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
export async function removeClassAssignmentAction(
  input: FeatureInput<typeof classroomFeatures.removeAssignment>,
) {
  const result = await classrooms.removeAssignment(
    await getCurrentUser(),
    input,
  );
  if (result.ok) refresh();
  return result;
}
export async function joinClassroomAction(
  input: FeatureInput<typeof classroomFeatures.joinByCode>,
) {
  const result = await classrooms.joinByCode(await getCurrentUser(), input);
  if (result.ok) refresh();
  return result;
}
