import Link from "next/link";
import { getCurrentUser } from "@/modules/platform";
import { redirect } from "next/navigation";
import { PageHeading } from "@/shared/ui/primitives";

export default async function AdminPage() {
  if ((await getCurrentUser()).role !== "admin") redirect("/");
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Admin workspace"
        description="The admin role is reserved. Management features are not implemented yet."
      />
      <section className="panel">
        <p>Your account is authenticated.</p>
        <Link href="/" className="text-link">
          Back to workspace
        </Link>
      </section>
    </>
  );
}
