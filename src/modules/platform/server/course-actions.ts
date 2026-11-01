"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./identity";
import { deleteOwnedCourse } from "./services";
import type { ActionResult } from "@/shared/contracts";
import { actionError } from "@/shared/contracts/errors";

export async function deleteOwnedCourseAction(
  courseId: string,
): Promise<ActionResult<{ destination: string }>> {
  try {
    const actor = await getCurrentUser();
    await deleteOwnedCourse(actor, courseId);
    revalidatePath("/teacher", "layout");
    revalidatePath("/student", "layout");
    return {
      ok: true,
      data: {
        destination: "/student/progress",
      },
    };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
