"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StudentDirectoryEntry } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { addStudentsAction } from "../server/actions";

export function StudentPicker({
  classId,
  students,
  query,
}: {
  classId: string;
  students: StudentDirectoryEntry[];
  query: string;
}) {
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div className="grid gap-4">
      <div>
        <p className="eyebrow">ADD STUDENTS</p>
        <h2>Student directory</h2>
        <p className="muted">
          Select registered students to add them to this class.
        </p>
      </div>
      <form
        action={`/teacher/classes/${classId}`}
        method="get"
        className="flex gap-2"
      >
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by name or email"
          aria-label="Search students"
          maxLength={100}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const emails = new FormData(form).getAll("emails").map(String);
          setStatus("");
          if (!emails.length) {
            setStatus("Select at least one student.");
            return;
          }
          startTransition(async () => {
            const result = await addStudentsAction(classId, emails);
            if (result.ok) {
              setStatus(
                result.data.added.length
                  ? `Added ${result.data.added.length} ${
                      result.data.added.length === 1 ? "student" : "students"
                    }.`
                  : "Those students are already in this class.",
              );
              form.reset();
              router.refresh();
            } else setStatus(result.error);
          });
        }}
      >
        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {students.map((student) => (
            <label
              key={student.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-2 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                name="emails"
                value={student.email}
                className="mt-0.5 size-4"
              />
              <span>
                <strong className="block">{student.name}</strong>
                <span className="muted">{student.email}</span>
              </span>
            </label>
          ))}
        </div>
        {!students.length && (
          <p className="muted">
            {query
              ? "No students match your search."
              : "All registered students are already in this class."}
          </p>
        )}
        <Button type="submit" disabled={pending || !students.length}>
          {pending ? "Adding…" : "Add selected"}
        </Button>
        {status && (
          <p className="form-hint" role="status">
            {status}
          </p>
        )}
      </form>
    </div>
  );
}
