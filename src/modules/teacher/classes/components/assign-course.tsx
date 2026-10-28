"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus } from "lucide-react";
import type { AssignableCourse } from "@/shared/contracts";
import { assignClassCourseAction } from "@/modules/platform/actions";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import styles from "@/modules/platform/classes/classes.module.css";
export function AssignCourseDialog({
  classId,
  courses,
}: {
  classId: string;
  courses: AssignableCourse[];
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const selected = courses.find((course) => course.id === courseId);
  const [version, setVersion] = useState(courses[0]?.publishedVersion ?? 1);
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
          setCourseId(courses[0]?.id ?? "");
          setVersion(courses[0]?.publishedVersion ?? 1);
          setDue("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <BookPlus size={16} /> Assign course
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Plan the next learning step</DialogTitle>
          <DialogDescription>
            Assign one of your published teaching courses. Students learn the
            version you select, even if you publish a newer version later.
          </DialogDescription>
        </DialogHeader>
        {!courses.length ? (
          <>
            <p className={styles.hint}>
              You have no available published teaching courses. Publish a course
              first, then return here.
            </p>
            <Link className="button primary" href="/teacher/creations">
              Go to My Creations
            </Link>
          </>
        ) : (
          <form
            className={styles.fields}
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              startTransition(async () => {
                const dueAt = due
                  ? new Date(`${due}T23:59:59+08:00`).toISOString()
                  : undefined;
                const response = await assignClassCourseAction({
                  classId,
                  courseId,
                  courseVersion: version,
                  ...(dueAt ? { dueAt } : {}),
                });
                if (response.ok) {
                  setOpen(false);
                  router.refresh();
                } else setError(response.error);
              });
            }}
          >
            <label htmlFor="assignment-course">
              Course
              <select
                id="assignment-course"
                className={styles.select}
                value={courseId}
                disabled={pending}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setVersion(
                    courses.find((item) => item.id === event.target.value)!
                      .publishedVersion,
                  );
                }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="assignment-version">
              Published version
              <select
                id="assignment-version"
                className={styles.select}
                value={version}
                disabled={pending}
                onChange={(event) => setVersion(Number(event.target.value))}
              >
                {selected?.versions.map((item) => (
                  <option key={item} value={item}>
                    Version {item}
                    {item === selected.publishedVersion ? " · latest" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="assignment-due">
              Due date{" "}
              <span className={styles.hint}>
                Optional · End of day in Hong Kong time (UTC+8)
              </span>
              <Input
                id="assignment-due"
                type="date"
                value={due}
                disabled={pending}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <p className={styles.hint}>
              The due date is a learning reminder; it does not close access.
              Reassigning an existing course version keeps its current due date.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !selected}>
                {pending ? "Assigning…" : "Assign to class"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
