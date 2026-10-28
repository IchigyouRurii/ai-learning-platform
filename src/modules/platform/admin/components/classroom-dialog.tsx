"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import type { AdminClassroomEntry, FeatureResult } from "@/shared/contracts";
import {
  setClassroomStatusAction,
  adminRemoveClassroomMemberAction,
  adminRemoveClassroomAssignmentAction,
} from "@/modules/platform/actions";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import styles from "../admin.module.css";
type Props = { classroom: AdminClassroomEntry } & (
  | { kind: "status" }
  | { kind: "member"; studentId: string; targetName: string }
  | { kind: "assignment"; assignmentId: string; targetName: string }
);
export function AdminClassroomDialog(props: Props) {
  const { classroom, kind } = props;
  const restore = kind === "status" && classroom.status === "archived";
  const label =
    kind === "status"
      ? restore
        ? "Restore class"
        : "Archive class"
      : "Remove";
  const title =
    kind === "status"
      ? `${restore ? "Restore" : "Archive"} ${classroom.name}?`
      : `Remove ${props.targetName}?`;
  const description =
    kind === "status"
      ? restore
        ? "Existing class assignments become available again, subject to course availability. The teacher must generate a new join code."
        : "Joining, class editing and learning access granted by this class will pause. Members, assignments, previous records and independent course enrollments are retained. The current join code is revoked."
      : kind === "member"
        ? "This removes the student's class access and revokes the class join code to prevent rejoining with it. Other members remain. The teacher can generate a new code. Learning records and independent enrollments are retained."
        : "This revokes learning access from this assignment. Previous records and other valid access sources are retained.";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setReason("");
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={
            kind === "status"
              ? `${label}: ${classroom.name}`
              : `Remove ${props.targetName}`
          }
        >
          {kind === "status" &&
            (restore ? <RotateCcw size={14} /> : <Archive size={14} />)}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!pending}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className={styles.dialogFields}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              let result: FeatureResult<unknown>;
              if (props.kind === "status")
                result = await setClassroomStatusAction({
                  classId: classroom.id,
                  expectedStatus: classroom.status,
                  status: restore ? "active" : "archived",
                  reason,
                });
              else if (props.kind === "member")
                result = await adminRemoveClassroomMemberAction({
                  classId: classroom.id,
                  studentId: props.studentId,
                  reason,
                });
              else
                result = await adminRemoveClassroomAssignmentAction({
                  classId: classroom.id,
                  assignmentId: props.assignmentId,
                  reason,
                });
              if (result.ok) {
                setOpen(false);
                router.refresh();
              } else setError(result.error);
            });
          }}
        >
          <label htmlFor={id}>
            Reason
            <Textarea
              id={id}
              required
              maxLength={2000}
              rows={4}
              value={reason}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain this management action"
            />
          </label>
          <p className="form-hint">
            This action and reason are recorded. Archive reasons are visible to
            the class teacher and members.
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
            <Button type="submit" disabled={pending || !reason.trim()}>
              {pending
                ? "Saving…"
                : kind === "status"
                  ? label
                  : "Confirm removal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
