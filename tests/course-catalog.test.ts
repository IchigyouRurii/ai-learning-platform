import { describe, expect, it } from "vitest";
import {
  filterCatalog,
  subjectLabel,
  catalogSearchLocation,
} from "@/shared/ui/course-catalog";
import { catalogPreview } from "@/modules/teacher/course-builder/components/catalog-preview";

describe("course catalog search", () => {
  it("combines subject and case-insensitive title or author search", () => {
    expect(
      filterCatalog(
        catalogPreview,
        "Fallback author",
        "  PYTHON  ",
        "Computer Science",
      ).map((item) => item.id),
    ).toEqual(["preview-python"]);
    expect(
      filterCatalog(catalogPreview, "Fallback author", "claire", "All").map(
        (item) => item.id,
      ),
    ).toEqual(["preview-python"]);
    expect(
      filterCatalog(catalogPreview, "Fallback author", "python", "English"),
    ).toEqual([]);
  });
  it("normalizes legacy subject labels without modifying stored content", () => {
    const course = {
      title: "Requirements",
      description: "Practice",
      subject: "软件工程基础",
    };
    expect(subjectLabel(course.subject)).toBe("Computer Science");
    expect(
      filterCatalog([course], "Ethan", "ethan", "Computer Science"),
    ).toEqual([course]);
    expect(course.subject).toBe("软件工程基础");
    expect(subjectLabel("Physics")).toBe("Science");
    expect(subjectLabel("Uncategorized legacy topic")).toBe("Other");
  });
});

describe("catalog search navigation", () => {
  it("searches My Creation inline, discarding hidden subject filters and encoding text safely", () => {
    expect(
      catalogSearchLocation("/teacher/creations", "subject=English", "  A&B  "),
    ).toEqual({
      inline: true,
      href: "/teacher/creations?q=A%26B",
    });
  });
  it("clears an empty query without dropping the active subject", () => {
    expect(
      catalogSearchLocation("/teacher", "subject=English&q=old", "  "),
    ).toEqual({ inline: true, href: "/teacher?subject=English" });
  });
  it("only navigates to the marketplace when the current page has no catalog", () => {
    expect(
      catalogSearchLocation(
        "/teacher/courses/example",
        "secretContext=local",
        "Python",
      ),
    ).toEqual({ inline: false, href: "/teacher?q=Python" });
  });
});

describe("existing course subjects", () => {
  const courses = [
    {
      title: "Appreciating Su Dongpo's Song Ci",
      description: "Poetry",
      subject: "Classical Chinese Literature",
    },
    {
      title: "Introduction to Medieval Heraldry",
      description: "Heraldry",
      subject: "History",
    },
    {
      title: "Introduction to Human Computer Interaction",
      description: "Interfaces",
      subject: "Human Computer Interaction",
    },
    {
      title: "AI Coding Learning: From Idea to Working Program",
      description: "AI coding",
      subject: "AI-Assisted Programming",
    },
    {
      title: "Introduction to Faust",
      description: "Faust",
      subject: "Literature",
    },
  ];
  it("groups existing courses into the requested subjects for both labels and filters", () => {
    expect(
      courses.map((course) => subjectLabel(course.subject, course.title)),
    ).toEqual([
      "Literature",
      "Literature",
      "Computer Science",
      "Computer Science",
      "Literature",
    ]);
    expect(filterCatalog(courses, "Author", "", "Literature")).toHaveLength(3);
    expect(
      filterCatalog(courses, "Author", "", "Computer Science"),
    ).toHaveLength(2);
    expect(filterCatalog(courses, "Author", "heraldry", "Literature")).toEqual([
      courses[1],
    ]);
    expect(courses[1].subject).toBe("History");
  });
  it("does not classify unrelated history courses as literature", () => {
    expect(subjectLabel("History", "World History")).toBe("Other");
    expect(subjectLabel(" ai-assisted programming ")).toBe("Computer Science");
  });
});

it("keeps student marketplace searches inline and routes other student searches to the student catalog", () => {
  expect(
    catalogSearchLocation("/student", "subject=Literature", "Faust"),
  ).toEqual({ inline: true, href: "/student?subject=Literature&q=Faust" });
  expect(catalogSearchLocation("/student/progress", "", "AI")).toEqual({
    inline: false,
    href: "/student?q=AI",
  });
});
