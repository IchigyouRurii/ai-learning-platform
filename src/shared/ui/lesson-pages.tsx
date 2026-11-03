"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MarkdownText } from "./markdown";

export function splitPages(body: string) {
  return body
    .split(/\n\s*---\s*\n/)
    .map((page) => page.trim())
    .filter(Boolean);
}

export function LessonPages({ body }: { body: string }) {
  const pages = splitPages(body);
  const [index, setIndex] = useState(0);
  if (pages.length === 0) return <p className="muted">No lesson content.</p>;
  const safeIndex = Math.min(index, pages.length - 1);
  return (
    <div className="lesson-pages">
      <MarkdownText text={pages[safeIndex]} />
      {pages.length > 1 && (
        <div className="page-controls">
          <button
            type="button"
            className="button secondary"
            disabled={safeIndex === 0}
            onClick={() => setIndex(Math.max(0, safeIndex - 1))}
          >
            <ChevronLeft size={15} />
            Previous
          </button>
          <span className="page-count">
            Page {safeIndex + 1} / {pages.length}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={safeIndex >= pages.length - 1}
            onClick={() => setIndex(Math.min(pages.length - 1, safeIndex + 1))}
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
