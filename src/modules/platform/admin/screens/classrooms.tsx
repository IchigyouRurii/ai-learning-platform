import Link from "next/link";
import { Search, School } from "lucide-react";
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
import { AdminClassroomDialog } from "../components/classroom-dialog";
import { AdminLoadError } from "../components/load-error";
import { type AdminSearchParams, displayDate, queryValue } from "../query";
import styles from "../admin.module.css";
export async function AdminClassroomsScreen({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const [actor, query] = await Promise.all([getCurrentUser(), searchParams]);
  const search = queryValue(query.q);
  const status = queryValue(query.status);
  const cursor = queryValue(query.cursor);
  const result = await platformExtensions.administration.listClassrooms(actor, {
    search,
    ...(status ? { status: status as "active" | "archived" } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  });
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="Classrooms"
        description="Review every class, its teaching community and learning availability."
      />
      <AdminTabs current="classrooms" />
      <AdminNote icon={<School size={17} />}>
        Archive a class to pause its activities while retaining members,
        assignments and learning history. Independent course enrollments remain
        available.
      </AdminNote>
      <section className={`panel ${styles.tablePanel}`}>
        <form action="/admin/classes" className={styles.toolbar}>
          <div className={styles.search}>
            <label className={styles.label} htmlFor="admin-classroom-search">
              Search classrooms
            </label>
            <Input
              id="admin-classroom-search"
              type="search"
              name="q"
              defaultValue={search}
              maxLength={200}
              placeholder="Search class names or teachers"
            />
          </div>
          <div className={styles.filter}>
            <label className={styles.label} htmlFor="classroom-status">
              Status
            </label>
            <select
              id="classroom-status"
              name="status"
              className={styles.select}
              defaultValue={status}
            >
              <option value="">All classes</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <Button type="submit">
            <Search size={15} />
            Search
          </Button>
          {(search || status || cursor) && (
            <Button asChild variant="ghost">
              <Link href="/admin/classes">Reset</Link>
            </Button>
          )}
        </form>
        {!result.ok ? (
          <AdminLoadError message={result.error} />
        ) : !result.data.items.length ? (
          <EmptyState title="No classrooms found">
            Try another class name, teacher or status filter.
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className={styles.courseTitle}>
                        <Link
                          href={`/admin/classes/${item.id}`}
                          className={styles.name}
                        >
                          {item.name}
                        </Link>
                        {item.description && (
                          <span className={styles.secondary}>
                            {item.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.teacherName}</TableCell>
                    <TableCell>{item.memberCount}</TableCell>
                    <TableCell>{item.assignmentCount}</TableCell>
                    <TableCell>
                      <Badge
                        tone={item.status === "active" ? "green" : "amber"}
                      >
                        {item.status === "active" ? "Active" : "Archived"}
                      </Badge>
                      {item.status === "archived" && (
                        <p className={styles.reason}>{item.archiveReason}</p>
                      )}
                    </TableCell>
                    <TableCell>{displayDate(item.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/classes/${item.id}`}>
                            Details
                          </Link>
                        </Button>
                        <AdminClassroomDialog kind="status" classroom={item} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <AdminPagination
              base="/admin/classes"
              filters={{ q: search, status }}
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
