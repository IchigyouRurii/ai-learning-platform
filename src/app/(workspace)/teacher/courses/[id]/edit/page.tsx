import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getCourseDocumentForAuthor,
  getCurrentUser,
  listGenerationRecords,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { CourseEditor } from "@/modules/course-generation/components/course-editor";

export default async function EditTeacherCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const { id } = await params;
  const document = await getCourseDocumentForAuthor(user, id).catch(
    () => null,
  );
  if (!document) notFound();
  const rewriteHistory = await listGenerationRecords(user, {
    kind: "rewrite",
    courseId: id,
    limit: 20,
  });
  return (
    <>
      <Link href={`/teacher/courses/${id}`} className="back-link">
        <ArrowLeft size={15} />
        Back to course
      </Link>
      <PageHeading
        eyebrow="COURSE EDITOR"
        title={document.content.title}
        description="Edit the draft, ask AI to rewrite a section, then publish a new version."
      />
      <CourseEditor
        courseId={document.id}
        initialContent={document.content}
        initialDraftRevision={document.draftRevision}
        publishedVersion={document.publishedVersion}
        mode="teacher"
        rewriteHistory={rewriteHistory}
      />
    </>
  );
}
