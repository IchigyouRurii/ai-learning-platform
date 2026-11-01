import { getCurrentUser, platformExtensions } from "@/modules/platform";
import {
  MyAnnotations,
  type AnnotationContext,
} from "../components/my-annotations";

/** Secondary detail content, streamed independently of the course body. */
export async function StudentCourseAnnotations({
  courseId,
  courseVersion,
  context,
}: {
  courseId: string;
  courseVersion: number;
  context: AnnotationContext;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "student") return null;
  const result = await platformExtensions.annotations.listMine(actor, {
    courseId,
    courseVersion,
    limit: 100,
  });
  return (
    <MyAnnotations
      courseId={courseId}
      annotations={result.ok ? result.data.items : []}
      context={context}
    />
  );
}
