"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, platformExtensions } from "@/modules/platform";

export async function createClassAction(input: {
  name: string;
  description: string;
  courseId: string;
  studentIds: string[];
}) {
  const result = await platformExtensions.classrooms.create(
    await getCurrentUser(),
    input,
  );
  if (result.ok) {
    revalidatePath("/teacher/classes");
    revalidatePath("/student/classes");
    revalidatePath("/student");
  }
  return result;
}

export async function deleteClassAction(classId: string) {
  const result = await platformExtensions.classrooms.deleteClass(
    await getCurrentUser(),
    { classId },
  );
  if (result.ok) {
    revalidatePath("/teacher/classes");
    revalidatePath("/student/classes");
    revalidatePath("/student");
  }
  return result;
}

export async function addStudentsAction(classId: string, emails: string[]) {
  const result = await platformExtensions.classrooms.importStudents(
    await getCurrentUser(),
    { classId, emails },
  );
  if (result.ok) {
    revalidatePath(`/teacher/classes/${classId}`);
    revalidatePath("/student/classes");
    revalidatePath("/student");
  }
  return result;
}

export async function removeMemberAction(classId: string, studentId: string) {
  const result = await platformExtensions.classrooms.removeMember(
    await getCurrentUser(),
    { classId, studentId },
  );
  if (result.ok) {
    revalidatePath(`/teacher/classes/${classId}`);
    revalidatePath("/student/classes");
  }
  return result;
}
