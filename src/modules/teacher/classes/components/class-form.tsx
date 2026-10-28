"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { Classroom } from "@/shared/contracts";
import {
  createClassroomAction,
  updateClassroomAction,
} from "@/modules/platform/actions";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
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
export function ClassForm({ classroom }: { classroom?: Classroom }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(classroom?.name ?? "");
  const [description, setDescription] = useState(classroom?.description ?? "");
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
          setName(classroom?.name ?? "");
          setDescription(classroom?.description ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={classroom ? "outline" : "default"}>
          {classroom ? <Pencil size={15} /> : <Plus size={16} />}{" "}
          {classroom ? "Edit class" : "Create class"}
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
          <DialogTitle>
            {classroom ? "Edit your class" : "Bring your learners together"}
          </DialogTitle>
          <DialogDescription>
            Give your class a name and a short introduction. Students can join
            using a code you share.
          </DialogDescription>
        </DialogHeader>
        <form
          className={styles.fields}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = classroom
                ? await updateClassroomAction({
                    classId: classroom.id,
                    name,
                    description,
                  })
                : await createClassroomAction({ name, description });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.push(`/teacher/classes/${result.data.id}`);
              router.refresh();
            });
          }}
        >
          <label htmlFor="class-name">
            Class name
            <Input
              id="class-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              placeholder="e.g. Introduction to AI · Group A"
            />
          </label>
          <label htmlFor="class-description">
            Description <span className={styles.hint}>Optional</span>
            <Textarea
              id="class-description"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
              rows={4}
              placeholder="What will this class learn together?"
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
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending
                ? "Saving…"
                : classroom
                  ? "Save changes"
                  : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
