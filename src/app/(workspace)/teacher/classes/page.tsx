import { TeacherClasses } from "@/modules/teacher/classes/screens/classes";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  return <TeacherClasses cursor={(await searchParams).cursor} />;
}
