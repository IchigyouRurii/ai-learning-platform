import { describe, expect, it } from "vitest";
import { filterCatalog, subjectLabel } from "@/shared/ui/course-catalog";
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
    expect(subjectLabel("Physics")).toBe("Physics");
  });
});
