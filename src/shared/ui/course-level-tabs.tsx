"use client";

import { COURSE_LEVELS, type CourseLevel } from "@/shared/contracts";
export function CourseLevelTabs({
  value,
  onChange,
  disabled = false,
}: {
  value: CourseLevel;
  onChange: (level: CourseLevel) => void;
  disabled?: boolean;
}) {
  return (
    <nav
      className="subject-tabs course-level-tabs"
      aria-label="Course difficulty"
    >
      {COURSE_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          disabled={disabled}
          className={`subject-tab${value === level ? " selected" : ""}`}
          aria-pressed={value === level}
          onClick={() => onChange(level)}
        >
          {level[0].toUpperCase() + level.slice(1)}
        </button>
      ))}
    </nav>
  );
}
