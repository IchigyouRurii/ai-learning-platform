"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type Option = { id: string; title: string; subject: string };

/** Search and selection share one keyboard-accessible combobox. */
export function MarketplaceCoursePicker({
  courses,
  disabled,
  onSelect,
}: {
  courses: Option[];
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = courses.filter((course) =>
    `${course.title} ${course.subject}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const select = (course: Option) => {
    onSelect(course.id);
    setQuery("");
    setOpen(false);
    setActive(0);
  };
  return (
    <div
      className="path-course-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>Add a Marketplace course</label>
      <div className="path-course-picker-input">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && options[active] ? `${id}-option-${active}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder="Select or search courses…"
          value={query}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                !open
                  ? 0
                  : Math.max(
                      0,
                      Math.min(
                        options.length - 1,
                        index + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (options[active]) select(options[active]);
            }
          }}
        />
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {open && (
        <div
          className="path-course-picker-options"
          id={`${id}-options`}
          role="listbox"
          aria-label="Marketplace courses"
        >
          {options.length ? (
            options.map((course, index) => (
              <div
                id={`${id}-option-${index}`}
                key={course.id}
                role="option"
                aria-selected={index === active}
                className={index === active ? "is-active" : ""}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(course)}
              >
                <strong>{course.title}</strong>
                <small>{course.subject}</small>
              </div>
            ))
          ) : (
            <p className="muted">
              {courses.length
                ? "No matching courses."
                : "All available courses have been added."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
