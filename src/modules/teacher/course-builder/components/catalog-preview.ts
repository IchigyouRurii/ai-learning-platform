// Display-only Figma fixtures. Never persist these or pass their IDs to services.
export const catalogPreview = [
  {
    id: "preview-software",
    subject: "Computer Science",
    title: "Software Engineering Methods",
    description: "Build an engineering mindset from requirements to delivery.",
    author: "Ethan Lin",
  },
  {
    id: "preview-python",
    subject: "Computer Science",
    title: "Data Analysis with Python",
    description: "Turn complex datasets into clear, actionable insights.",
    author: "Claire Chen",
  },
  {
    id: "preview-algebra",
    subject: "Mathematics",
    title: "Foundations of Linear Algebra",
    description: "Explore linear relationships through vectors and matrices.",
    author: "James Li",
  },
  {
    id: "preview-english",
    subject: "English",
    title: "Academic English Writing",
    description: "Develop clear arguments and confident academic prose.",
    author: "Nora Wu",
  },
  {
    id: "preview-statistics",
    subject: "Mathematics",
    title: "Probability and Statistics",
    description: "Understand uncertainty with statistical models and methods.",
    author: "Kai Zhao",
  },
  {
    id: "preview-product",
    subject: "Business",
    title: "Product Thinking and Decisions",
    description: "Create effective product strategies around real user needs.",
    author: "Miles Zhou",
  },
].map((course) => ({
  ...course,
  preview: true as const,
  status: "published" as const,
  lessons: [],
}));
