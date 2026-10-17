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
        title="管理工作空间"
        description="管理员角色已预留，具体管理功能将在需求确认后添加。"
      />
      <section className="panel">
        <p>当前账号已通过身份验证。</p>
        <Link href="/" className="text-link">
          返回工作空间
        </Link>
      </section>
    </>
  );
}
