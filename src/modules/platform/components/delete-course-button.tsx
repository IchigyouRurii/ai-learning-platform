"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteOwnedCourseAction } from "@/modules/platform/actions";

export function DeleteCourseButton({
  courseId,
  title,
}: {
  courseId: string;
  title: string;
}) {
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
        <button className="button secondary">
          <Trash2 size={15} />
          Delete
        </button>
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
          <DialogTitle>Delete this course?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            “{title}” and your own learning records for this course will be
            permanently deleted. This cannot be undone. Courses linked to a
            class or another learner cannot be deleted.
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
                  const result = await deleteOwnedCourseAction(courseId);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.replace(result.data.destination);
                  router.refresh();
                } catch {
                  setError("Unable to delete this course. Please try again.");
                }
              })
            }
          >
            {pending ? "Deleting…" : "Delete Course"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
