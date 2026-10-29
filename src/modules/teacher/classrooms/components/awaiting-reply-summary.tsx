"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatCard } from "@/shared/ui/primitives";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/shared/ui/components/dialog";

export function AwaitingReplySummary({
  courseId, courseTitle, questions, notes, available,
}: {
  courseId: string;
  courseTitle: string;
  questions: number;
  notes: number;
  available: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full text-left rounded-[var(--ui-card-radius)] focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard
            label="Awaiting reply"
            value={available ? questions + notes : "Unavailable"}
            detail={available ? `${questions} questions · ${notes} private notes · Click to view` : "Click for details"}
            icon={<AlertTriangle size={17} />}
          />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Awaiting reply</DialogTitle>
          <DialogDescription>
            Open discussions and private notes from current class members in this class’s course.
          </DialogDescription>
        </DialogHeader>
        {!available ? (
          <p role="alert" className="error-text">Could not load pending replies. Refresh and try again.</p>
        ) : questions + notes === 0 ? (
          <p className="muted">No discussions or private notes awaiting your reply.</p>
        ) : (
          <article className="grid gap-4 rounded-lg border border-border p-4">
            <h3 className="font-medium">{courseTitle}</h3>
            <p className="muted">{questions} discussions · {notes} private notes awaiting reply</p>
            <div className="flex flex-wrap gap-2">
              {questions > 0 && (
                <Button asChild variant="outline">
                  <Link href={`/teacher/courses/${courseId}#course-discussions`}>Open discussions ({questions})</Link>
                </Button>
              )}
              {notes > 0 && (
                <Button asChild variant="outline">
                  <Link href={`/teacher/students?courseId=${encodeURIComponent(courseId)}#private-notes`}>Open private notes ({notes})</Link>
                </Button>
              )}
            </div>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
