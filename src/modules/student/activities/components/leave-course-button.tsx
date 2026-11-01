"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/components/dialog";
import { leaveCourseAction } from "../server/actions";

export function LeaveCourseButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="button secondary">Leave Course</button>
      </DialogTrigger>
      <DialogContent
        className="leave-course-dialog"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Leave this course?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Your learning progress will be saved. Re-enroll at the same
            difficulty to continue where you left off.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <button className="button secondary" disabled={pending}>
              Cancel
            </button>
          </DialogClose>
          <button
            className="button primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError("");
                try {
                  const result = await leaveCourseAction(courseId);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError("Unable to leave the course. Please try again.");
                }
              })
            }
          >
            {pending ? "Leaving…" : "Leave Course"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
