"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./identity";
import { administration } from "./extensions/administration";
import type { administrationFeatures, FeatureInput } from "@/shared/contracts";

export async function changeUserRoleAction(
  input: FeatureInput<typeof administrationFeatures.changeRole>,
) {
  const result = await administration.changeRole(await getCurrentUser(), input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function withdrawCourseAction(
  input: FeatureInput<typeof administrationFeatures.withdrawCourse>,
) {
  const result = await administration.withdrawCourse(
    await getCurrentUser(),
    input,
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
