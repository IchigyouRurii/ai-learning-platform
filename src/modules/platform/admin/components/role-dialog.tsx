"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { changeUserRoleAction } from "@/modules/platform/actions";
import type { Role, UserDirectoryEntry } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import styles from "../admin.module.css";

export function RoleDialog({
  user,
  currentUserId,
}: {
  user: UserDirectoryEntry;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) {
            setOpen(value);
            setRole(user.role);
            setError("");
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Change role for ${user.name}`}
          >
            <ShieldCheck size={14} />
            Change role
          </Button>
        </DialogTrigger>
        <DialogContent showCloseButton={!pending}>
          <DialogTitle>Change account role</DialogTitle>
          <DialogDescription>
            Choose the access this person needs. They will need to sign in again
            after a role change.
          </DialogDescription>
          <form
            className={styles.dialogFields}
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              setMessage("");
              startTransition(async () => {
                try {
                  const result = await changeUserRoleAction({
                    userId: user.id,
                    expectedRole: user.role,
                    role,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  setMessage("Role updated.");
                  if (user.id === currentUserId) router.replace("/login");
                  router.refresh();
                } catch {
                  setError("Unable to update this role. Please try again.");
                }
              });
            }}
          >
            <div className={styles.dialogSummary}>
              <strong>{user.name}</strong>
              <span className={styles.secondary}>{user.email}</span>
            </div>
            <label htmlFor={`role-${user.id}`}>
              New role
              <select
                id={`role-${user.id}`}
                className={styles.select}
                value={role}
                disabled={pending}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="student">
                  Student — learn and create personal courses
                </option>
                <option value="teacher">
                  Teacher — create courses and guide learners
                </option>
                <option value="admin">
                  Admin — manage users and teaching courses
                </option>
              </select>
            </label>
            {role === "admin" && role !== user.role && (
              <p className="form-hint">
                Administrator access includes changing other users’ roles and
                withdrawing teaching courses.
              </p>
            )}
            {user.id === currentUserId && role !== "admin" && (
              <p className="form-hint">
                You are changing your own role. You will leave this workspace
                and be asked to sign in again.
              </p>
            )}
            <p className="form-hint">
              The last administrator is protected. Course and classroom
              ownership must be resolved before changing an author’s role.
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
              <Button type="submit" disabled={pending || role === user.role}>
                {pending && <LoaderCircle className="spin" size={15} />}
                {pending ? "Updating…" : "Confirm role change"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {message && (
        <span className={styles.success} role="status">
          {message}
        </span>
      )}
    </>
  );
}
