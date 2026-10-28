"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import {
  createClassJoinCodeAction,
  importClassStudentsAction,
  removeClassMemberAction,
  removeClassAssignmentAction,
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
import styles from "@/modules/platform/classes/classes.module.css";
export function JoinCodeDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
          setCopied(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound size={15} /> Join code
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Invite students with a code</DialogTitle>
          <DialogDescription>
            Share this code with your students. Codes expire after 7 days.
            Generating a new code invalidates the previous one; existing members
            remain in the class.
          </DialogDescription>
        </DialogHeader>
        {code && (
          <div className={styles.result}>
            <p className={styles.code}>{code.code}</p>
            <span className={styles.hint}>
              Expires {new Date(code.expiresAt).toLocaleString()}
            </span>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code.code);
                  setCopied(true);
                } catch {
                  setError(
                    "Copy is unavailable. Select the code and copy it manually.",
                  );
                }
              }}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                const result = await createClassJoinCodeAction({ classId });
                if (result.ok) {
                  setCode(result.data);
                  setCopied(false);
                } else setError(result.error);
              });
            }}
          >
            {pending
              ? "Generating…"
              : code
                ? "Replace with a new code"
                : "Generate new code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function ImportStudentsDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    added: string[];
    missingEmails: string[];
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus size={15} /> Add existing students
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Add existing student accounts</DialogTitle>
          <DialogDescription>
            Enter registered student email addresses, separated by commas or new
            lines. This adds them directly; it does not send invitation emails
            or create accounts.
          </DialogDescription>
        </DialogHeader>
        <form
          className={styles.fields}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setResult(null);
            startTransition(async () => {
              const response = await importClassStudentsAction({
                classId,
                emails: emails
                  .split(/[\s,;]+/)
                  .map((email) => email.trim())
                  .filter(Boolean),
              });
              if (response.ok) {
                setResult(response.data);
                router.refresh();
              } else setError(response.error);
            });
          }}
        >
          <label htmlFor="student-emails">
            Student emails
            <Textarea
              id="student-emails"
              required
              rows={5}
              maxLength={32000}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              disabled={pending}
              placeholder="student@example.com"
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className={styles.result} role="status">
              <strong>{result.added.length} students added</strong>
              <p className={styles.hint}>
                Existing members are kept without duplicates.
              </p>
              {result.missingEmails.length > 0 && (
                <p className={styles.hint}>
                  No matching student account: {result.missingEmails.join(", ")}
                  . Ask them to register or use a join code.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button type="submit" disabled={pending || !emails.trim()}>
              {pending ? "Adding…" : "Add students"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ClassRemovalDialog({
  classId,
  targetId,
  name,
  kind,
}: {
  classId: string;
  targetId: string;
  name: string;
  kind: "member" | "assignment";
}) {
  const [open, setOpen] = useState(false);
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
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Remove ${name}`}>
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {kind === "member"
              ? "Remove student from this class?"
              : "Remove this course assignment?"}
          </DialogTitle>
          <DialogDescription>
            {name}.{" "}
            {kind === "member"
              ? "This student will lose access granted by this class."
              : "Students will lose access granted by this assignment."}{" "}
            Existing learning records and independently enrolled courses are
            retained.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                const response =
                  kind === "member"
                    ? await removeClassMemberAction({
                        classId,
                        studentId: targetId,
                      })
                    : await removeClassAssignmentAction({
                        classId,
                        assignmentId: targetId,
                      });
                if (response.ok) {
                  setOpen(false);
                  router.refresh();
                } else setError(response.error);
              });
            }}
          >
            {pending ? "Removing…" : "Confirm removal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
