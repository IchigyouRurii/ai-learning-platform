// Normalize existing subject labels for filtering; never alter stored course content.
export function subjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    计算机科学: "Computer Science",
    软件工程基础: "Computer Science",
    "AI 编程协作": "Computer Science",
    数学: "Mathematics",
    英语: "English",
    产品与沟通: "Business",
    商业: "Business",
  };
  return labels[subject] ?? subject;
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
      (subject === "All" || subjectLabel(course.subject) === subject) &&
      (!term ||
        [
          course.title,
          course.description,
          course.subject,
          subjectLabel(course.subject),
          course.author ?? author,
        ].some((value) => value.toLocaleLowerCase("en-US").includes(term))),
  );
}
