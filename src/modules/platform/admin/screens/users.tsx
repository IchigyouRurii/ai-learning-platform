import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type { Role } from "@/shared/contracts";
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
import { AdminLoadError } from "../components/load-error";
import { RoleDialog } from "../components/role-dialog";
import { type AdminSearchParams, displayDate, queryValue } from "../query";
import styles from "../admin.module.css";

export async function AdminUsersScreen({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const [actor, query] = await Promise.all([getCurrentUser(), searchParams]);
  const search = queryValue(query.q);
  const role = queryValue(query.role);
  const cursor = queryValue(query.cursor);
  const result = await platformExtensions.administration.listUsers(actor, {
    search,
    ...(role ? { role: role as Role } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  });
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="Users & access"
        description="Find a person and give them the access they need."
      />
      <AdminTabs current="users" />
      <AdminNote icon={<ShieldCheck size={17} />}>
        Role changes sign the affected user out. Course ownership and the last
        administrator are protected.
      </AdminNote>
      <section className={`panel ${styles.tablePanel}`}>
        <form action="/admin/users" className={styles.toolbar}>
          <div className={styles.search}>
            <label className={styles.label} htmlFor="user-search">
              Search accounts
            </label>
            <Input
              id="user-search"
              type="search"
              name="q"
              defaultValue={search}
              maxLength={200}
              placeholder="Search by name or email"
            />
          </div>
          <div className={styles.filter}>
            <label className={styles.label} htmlFor="user-role-filter">
              Account role
            </label>
            <select
              id="user-role-filter"
              className={styles.select}
              name="role"
              defaultValue={role}
            >
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
          <Button type="submit">
            <Search size={15} />
            Search
          </Button>
          {(search || role || cursor) && (
            <Button asChild variant="ghost">
              <Link href="/admin/users">Reset</Link>
            </Button>
          )}
        </form>
        {!result.ok ? (
          <AdminLoadError message={result.error} />
        ) : !result.data.items.length ? (
          <EmptyState title="No accounts found">
            Try a different name, email or role filter.
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Account</TableHead>
                  <TableHead scope="col">Role</TableHead>
                  <TableHead scope="col">Email status</TableHead>
                  <TableHead scope="col">Joined</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className={styles.identity}>
                        <span className="avatar" aria-hidden="true">
                          {user.name.trim().slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <span className={styles.name}>
                            {user.name}
                            {user.id === actor.id ? " (you)" : ""}
                          </span>
                          <span
                            className={`${styles.secondary} ${styles.email}`}
                          >
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          user.role === "admin"
                            ? "green"
                            : user.role === "teacher"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {user.role === "admin"
                          ? "Admin"
                          : user.role === "teacher"
                            ? "Teacher"
                            : "Student"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={styles.secondary}>
                        {user.emailVerified ? "Verified" : "Not verified"}
                      </span>
                    </TableCell>
                    <TableCell>{displayDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <RoleDialog user={user} currentUserId={actor.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <AdminPagination
              base="/admin/users"
              filters={{ q: search, role }}
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
