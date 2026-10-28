import { StudentClasses } from "@/modules/student/classes/screens/classes";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  return <StudentClasses cursor={(await searchParams).cursor} />;
}
