import { COURSE_SUBJECTS } from "@/shared/contracts/course";
// Normalize existing subject labels for filtering; never alter stored course content.
export function subjectLabel(subject: string, title?: string): string {
  // Explicit reclassification requested for this existing course only.
  // Other History courses must not be classified as Literature automatically.
  if (
    title?.trim() === "Introduction to Medieval Heraldry" &&
    subject.trim().toLowerCase() === "history"
  )
    return "Literature";
  const labels: Record<string, string> = {
    "AI-Assisted Programming": "Computer Science",
    "AI Programming": "Computer Science",
    "Human Computer Interaction": "Computer Science",
    "Human-Computer Interaction": "Computer Science",
    "Classical Chinese Literature": "Literature",
    文学: "Literature",
    中国古典文学: "Literature",
    "Product & Soft Skills": "Business",
    "Software Engineering": "Computer Science",
    "Software Engineering Fundamentals": "Computer Science",
    "AI Coding": "Computer Science",
    "Product and Communication": "Business",
    Math: "Mathematics",
    Physics: "Science",
    Chemistry: "Science",
    Biology: "Science",
    物理: "Science",
    化学: "Science",
    生物: "Science",
    科学: "Science",
    计算机科学: "Computer Science",
    软件工程基础: "Computer Science",
    "AI 编程协作": "Computer Science",
    数学: "Mathematics",
    英语: "English",
    产品与沟通: "Business",
    商业: "Business",
  };
  const normalized =
    Object.entries(labels).find(
      ([label]) => label.toLowerCase() === subject.trim().toLowerCase(),
    )?.[1] ?? subject;
  return (
    COURSE_SUBJECTS.find(
      (item) => item.toLowerCase() === normalized.trim().toLowerCase(),
    ) ?? "Other"
  );
}

export function filterCatalog<
  T extends {
    title: string;
    description: string;
    subject: string;
    author?: string;
  },
>(courses: T[], author: string, query: string, subject: string): T[] {
  const term = query.trim().toLocaleLowerCase("en-US");
  return courses.filter(
    (course) =>
      (subject === "All" ||
        subjectLabel(course.subject, course.title) === subject) &&
      (!term ||
        [
          course.title,
          course.description,
          course.subject,
          subjectLabel(course.subject, course.title),
          course.author ?? author,
        ].some((value) => value.toLocaleLowerCase("en-US").includes(term))),
  );
}

/** Keep catalog searches local and preserve subject filters; other pages open the catalog. */
export function catalogSearchLocation(
  pathname: string,
  search: string,
  query: string,
) {
  const marketplace = pathname.startsWith("/student") ? "/student" : "/teacher";
  const inline = pathname === marketplace || pathname === "/teacher/creations";
  const params = new URLSearchParams(inline ? search : "");
  if (pathname === "/teacher/creations") params.delete("subject");
  const term = query.trim();
  if (term) params.set("q", term);
  else params.delete("q");
  const base = inline ? pathname : marketplace;
  return {
    inline,
    href: `${base}${params.size ? `?${params.toString()}` : ""}`,
  };
}
