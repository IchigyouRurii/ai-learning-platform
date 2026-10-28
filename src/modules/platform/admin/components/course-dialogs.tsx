"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, LoaderCircle, ShieldOff } from "lucide-react";
import { withdrawCourseAction } from "@/modules/platform/actions";
import type { AdminCourseEntry } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import styles from "../admin.module.css";

export function CourseMetadataDialog({ course }: { course: AdminCourseEntry }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`View details for ${course.title}`}
        >
          <Eye size={14} />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{course.title}</DialogTitle>
        <DialogDescription>
          {course.subject} · {course.ownerName}
        </DialogDescription>
        <div className={styles.metadata}>
          <div>
            <h3>About this course</h3>
            <p>{course.description}</p>
          </div>
          <div>
            <h3>Learning goals</h3>
            <ul className="list-disc">
              {course.goals.map((goal, index) => (
                <li key={index}>{goal}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Chapter outline</h3>
            <ol className="list-decimal">
              {course.chapters.map((chapter) => (
                <li key={chapter.id}>{chapter.title}</li>
              ))}
            </ol>
          </div>
          {course.moderationStatus === "withdrawn" && (
            <div>
              <h3>Withdrawal reason</h3>
              <p>{course.moderationReason}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawCourseDialog({ course }: { course: AdminCourseEntry }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (course.moderationStatus === "withdrawn") return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Withdraw ${course.title}`}
        >
          <ShieldOff size={14} />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogTitle>Withdraw teaching course</DialogTitle>
        <DialogDescription>
          This removes the course from learning access. Existing enrollments,
          published versions and answers will be kept.
        </DialogDescription>
        <form
          className={styles.dialogFields}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              try {
                const result = await withdrawCourseAction({
                  courseId: course.id,
                  reason: reason.trim(),
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              } catch {
                setError("Unable to withdraw this course. Please try again.");
              }
            });
          }}
        >
          <div className={styles.dialogSummary}>
            <strong>{course.title}</strong>
            <span className={styles.secondary}>
              Created by {course.ownerName}
            </span>
          </div>
          <label htmlFor={`reason-${course.id}`}>
            Reason for withdrawal
            <Textarea
              id={`reason-${course.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={2000}
              rows={4}
              disabled={pending}
              placeholder="Explain what needs to be addressed before this course is suitable for learners."
            />
          </label>
          <p className="form-hint">
            Students will no longer be able to open, join or submit work for
            this course. The author can still review and edit it.
          </p>
          {error && (
            <p className={styles.error} role="alert">
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
            <Button
              variant="destructive"
              type="submit"
              disabled={pending || !reason.trim()}
            >
              {pending && <LoaderCircle className="spin" size={15} />}
              {pending ? "Withdrawing…" : "Confirm withdrawal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
