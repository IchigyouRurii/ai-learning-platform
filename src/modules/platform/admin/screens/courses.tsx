import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { Badge, EmptyState, PageHeading } from "@/shared/ui/primitives";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { AdminNote, AdminPagination, AdminTabs } from "../components/common";
import {
  CourseMetadataDialog,
  WithdrawCourseDialog,
} from "../components/course-dialogs";
import { AdminLoadError } from "../components/load-error";
import { type AdminSearchParams, displayDate, queryValue } from "../query";
import styles from "../admin.module.css";

export async function AdminCoursesScreen({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const [actor, query] = await Promise.all([getCurrentUser(), searchParams]);
  const search = queryValue(query.q);
  const moderationStatus = queryValue(query.status);
  const cursor = queryValue(query.cursor);
  const result = await platformExtensions.administration.listCourses(actor, {
    search,
    ...(moderationStatus
      ? { moderationStatus: moderationStatus as "active" | "withdrawn" }
      : {}),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  });
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="Teaching courses"
        description="Review the teaching catalog and manage learning availability."
      />
      <AdminTabs current="courses" />
      <AdminNote icon={<ShieldCheck size={17} />}>
        This directory includes teaching-course metadata only. Withdrawing a
        course preserves its versions and learning history.
      </AdminNote>
      <section className={`panel ${styles.tablePanel}`}>
        <form action="/admin/courses" className={styles.toolbar}>
          <div className={styles.search}>
            <label className={styles.label} htmlFor="admin-course-search">
              Search teaching courses
            </label>
            <Input
              id="admin-course-search"
              type="search"
              name="q"
              defaultValue={search}
              maxLength={200}
              placeholder="Search courses, subjects or instructors"
            />
          </div>
          <div className={styles.filter}>
            <label className={styles.label} htmlFor="course-status-filter">
              Availability
            </label>
            <select
              id="course-status-filter"
              className={styles.select}
              name="status"
              defaultValue={moderationStatus}
            >
              <option value="">All courses</option>
              <option value="active">Active</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <Button type="submit">
            <Search size={15} />
            Search
          </Button>
          {(search || moderationStatus || cursor) && (
            <Button asChild variant="ghost">
              <Link href="/admin/courses">Reset</Link>
            </Button>
          )}
        </form>
        {!result.ok ? (
          <AdminLoadError message={result.error} />
        ) : !result.data.items.length ? (
          <EmptyState title="No teaching courses found">
            Try another search or availability filter. Personal self-study
            courses are not listed here.
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Course</TableHead>
                  <TableHead scope="col">Instructor</TableHead>
                  <TableHead scope="col">Publication</TableHead>
                  <TableHead scope="col">Availability</TableHead>
                  <TableHead scope="col">Created</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className={styles.courseTitle}>
                        <strong className={styles.name}>{course.title}</strong>
                        <span className={styles.secondary}>
                          {course.subject} · {course.chapters.length} chapters
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{course.ownerName}</TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          course.status === "published" ? "green" : "neutral"
                        }
                      >
                        {course.publishedVersion
                          ? `Published v${course.publishedVersion}`
                          : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          course.moderationStatus === "withdrawn"
                            ? "amber"
                            : "green"
                        }
                      >
                        {course.moderationStatus === "withdrawn"
                          ? "Withdrawn"
                          : "Active"}
                      </Badge>
                      {course.moderationStatus === "withdrawn" && (
                        <p className={styles.reason}>
                          {course.moderationReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{displayDate(course.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <CourseMetadataDialog course={course} />
                        <WithdrawCourseDialog course={course} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <AdminPagination
              base="/admin/courses"
              filters={{ q: search, status: moderationStatus }}
              cursor={cursor}
              nextCursor={result.data.nextCursor}
              count={result.data.items.length}
            />
          </>
        )}
      </section>
    </>
  );
}
