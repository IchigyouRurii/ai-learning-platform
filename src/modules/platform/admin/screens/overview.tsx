import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { PageHeading, StatCard } from "@/shared/ui/primitives";
import { AdminTabs, AdminNote } from "../components/common";
import { AdminLoadError } from "../components/load-error";
import styles from "../admin.module.css";

export async function AdminOverviewScreen() {
  const actor = await getCurrentUser();
  const result = await platformExtensions.administration.getOverview(actor, {});
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="A clear view of your platform."
        description="Manage account access and keep teaching courses ready for learning."
      />
      <AdminTabs current="overview" />
      {!result.ok ? (
        <AdminLoadError message={result.error} />
      ) : (
        <>
          <section className={`stats-grid ${styles.stats}`}>
            <StatCard
              label="Platform users"
              value={result.data.users}
              detail="Students, teachers and administrators"
              icon={<Users size={17} />}
            />
            <StatCard
              label="Teaching courses"
              value={result.data.courses}
              detail="Drafts and published teaching courses"
              icon={<BookOpen size={17} />}
            />
            <StatCard
              label="Available to learn"
              value={result.data.publishedCourses}
              detail="Published and active courses"
              icon={<CheckCheck size={17} />}
            />
            <StatCard
              label="Withdrawn courses"
              value={result.data.withdrawnCourses}
              detail="Learning access suspended"
              icon={<ShieldOff size={17} />}
            />
          </section>
          <div className={styles.split}>
            <section className="panel">
              <h2 className={styles.sectionTitle}>Manage your platform</h2>
              <p className="muted">
                Choose a section to review and take action.
              </p>
              <Link href="/admin/users" className={styles.quickLink}>
                <span className={styles.quickIcon}>
                  <Users size={21} />
                </span>
                <span className={styles.quickBody}>
                  <strong className={styles.name}>Users & access</strong>
                  <span className={styles.secondary}>
                    Find accounts and assign the right role.
                  </span>
                </span>
                <ArrowUpRight size={19} />
              </Link>
              <Link href="/admin/courses" className={styles.quickLink}>
                <span className={styles.quickIcon}>
                  <BookOpen size={21} />
                </span>
                <span className={styles.quickBody}>
                  <strong className={styles.name}>Teaching courses</strong>
                  <span className={styles.secondary}>
                    Review course details and withdraw unsuitable content.
                  </span>
                </span>
                <ArrowUpRight size={19} />
              </Link>
            </section>
            <section className="panel">
              <h2 className={styles.sectionTitle}>Account roles</h2>
              <p className="muted">Access across the learning community.</p>
              <div className={styles.roleRow}>
                <span>Students</span>
                <strong>{result.data.students}</strong>
              </div>
              <div className={styles.roleRow}>
                <span>Teachers</span>
                <strong>{result.data.teachers}</strong>
              </div>
              <div className={styles.roleRow}>
                <span>Administrators</span>
                <strong>{result.data.admins}</strong>
              </div>
            </section>
          </div>
          <div className="mt-6">
            <AdminNote icon={<ShieldCheck size={17} />}>
              Role changes and withdrawals are recorded. Personal self-study
              courses stay outside the teaching-course directory.
            </AdminNote>
          </div>
        </>
      )}
    </>
  );
}
