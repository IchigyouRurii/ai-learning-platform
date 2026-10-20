"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudentDirectoryEntry } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";
import { createClassAction } from "../server/actions";

type CourseOption = { id: string; title: string };

export function CreateClassForm({
  courses,
  students,
  studentsError,
}: {
  courses: CourseOption[];
  students: StudentDirectoryEntry[];
  studentsError: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [studentQuery, setStudentQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const query = studentQuery.trim().toLowerCase();
  const filteredStudents = students.filter((student) =>
    `${student.name} ${student.email}`.toLowerCase().includes(query),
  );
  const canSubmit = Boolean(name.trim() && courseId) && courses.length > 0;

  function toggleStudent(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("");
        startTransition(async () => {
          const result = await createClassAction({
            name,
            description,
            courseId,
            studentIds: [...selected],
          });
          if (result.ok) {
            setName("");
            setDescription("");
            setStudentQuery("");
            setSelected(new Set());
            setStatus("Class created.");
            router.refresh();
          } else setStatus(result.error);
        });
      }}
    >
      <div>
        <p className="eyebrow">CREATE A CLASS</p>
        <h2>New class</h2>
        <p className="muted">
          Choose a published course, then select the students who should join
          it. Selected students are enrolled in the course automatically.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-name">Class name</Label>
        <Input
          id="class-name"
          name="name"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Software Engineering 101"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-course">Course</Label>
        {courses.length ? (
          <select
            id="class-course"
            name="courseId"
            required
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        ) : (
          <p className="error-text" role="alert">
            Publish a cohort course before creating a class.{" "}
            <Link href="/teacher/creations">Go to My Creations</Link>
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-description">Description</Label>
        <Textarea
          id="class-description"
          name="description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional notes for this class"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="class-student-search">
          Students ({selected.size} selected)
        </Label>
        {studentsError ? (
          <p className="error-text" role="alert">
            {studentsError}
          </p>
        ) : (
          <>
            <Input
              id="class-student-search"
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Filter by name or email"
              maxLength={100}
            />
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {filteredStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-2 text-sm hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <strong className="block">{student.name}</strong>
                    <span className="muted">{student.email}</span>
                  </span>
                </label>
              ))}
              {!filteredStudents.length && (
                <p className="muted">
                  {students.length
                    ? "No students match your filter."
                    : "No registered students available."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <Button type="submit" disabled={pending || !canSubmit}>
        {pending ? "Creating…" : "Create class"}
      </Button>
      {status && (
        <p className="form-hint" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
