"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { joinClassroomAction } from "@/modules/platform/actions";
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
export function JoinClassDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
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
          setCode("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <KeyRound size={16} /> Join a class
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Join your learning community</DialogTitle>
          <DialogDescription>
            Enter the join code shared by your teacher. You’ll find your
            assigned courses in the class.
          </DialogDescription>
        </DialogHeader>
        <form
          className={styles.fields}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await joinClassroomAction({ code });
              if (result.ok) {
                setOpen(false);
                router.push(`/student/classes/${result.data.id}`);
                router.refresh();
              } else setError(result.error);
            });
          }}
        >
          <label htmlFor="class-join-code">
            Class join code
            <Input
              id="class-join-code"
              autoComplete="off"
              required
              minLength={6}
              maxLength={100}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={pending}
              placeholder="Enter your teacher’s code"
            />
          </label>
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
            <Button type="submit" disabled={pending || code.trim().length < 6}>
              {pending ? "Joining…" : "Join class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
