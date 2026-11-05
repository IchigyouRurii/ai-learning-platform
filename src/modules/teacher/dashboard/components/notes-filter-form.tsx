import Link from "next/link";
import { Button } from "@/shared/ui/components/button";
import { Label } from "@/shared/ui/components/label";

const selectClass =
  "h-10 rounded-[var(--ui-control-radius)] border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function NotesFilterForm({
  courseOptions,
  selectedCourseId,
  status,
  noteCount,
}: {
  courseOptions: { id: string; title: string }[];
  selectedCourseId: string;
  status: string;
  noteCount: number;
}) {
  return (
    <form method="get" action="/teacher/students" className="panel">
      <input type="hidden" name="view" value="notes" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid content-start gap-2">
          <Label htmlFor="notes-course">Course</Label>
          <select
            id="notes-course"
            name="course"
            defaultValue={selectedCourseId}
            className={selectClass}
          >
            <option value="">All courses</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="notes-status">Status</Label>
          <select
            id="notes-status"
            name="status"
            defaultValue={status}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="open">Unprocessed</option>
            <option value="replied">Replied</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium text-foreground">Results</span>
          <p className="muted text-sm">
            {noteCount} {noteCount === 1 ? "note" : "notes"} shown.
          </p>
          <p className="form-hint">
            Private notes are scoped to your own courses. Up to 100 notes are
            shown at a time.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        <Link href="/teacher/students?view=notes" className="text-link text-sm">
          Reset filters
        </Link>
      </div>
    </form>
  );
}
