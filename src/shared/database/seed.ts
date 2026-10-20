import type { Course, DemoState } from "@/shared/contracts";

const createdAt = "2026-10-16T00:00:00.000Z";
function seedCourse(
  id: string,
  title: string,
  description: string,
  subject: string,
  audience: string,
  goal: string,
  body: string,
  prompt: string,
): Course {
  return {
    id,
    title,
    description,
    subject,
    audience,
    goals: [goal],
    ownerId: "demo-teacher",
    status: "published",
    visibility: "cohort",
    version: 1,
    createdAt,
    updatedAt: createdAt,
    lessons: [
      {
        id: `${id}-lesson-1`,
        title: "Start with a real problem",
        blocks: [
          { id: `${id}-text`, type: "text", body },
          {
            id: `${id}-block`,
            type: "activity",
            activity: {
              id: `${id}-activity-1`,
              type: "reflection",
              title: "Your turn to try",
              prompt,
              rubric:
                "Describe a specific scenario, explain your reasoning, and suggest a testable next step. Guide the learner without completing the task for them.",
            },
          },
        ],
      },
    ],
  };
}

export function createSeedState(): DemoState {
  return {
    schemaVersion: 1,
    courses: [
      seedCourse(
        "ai-coding",
        "Software Engineering Methods",
        "Build an engineering mindset from requirements to delivery.",
        "Computer Science",
        "Beginners exploring software development in the AI era",
        "Explain how requirements, design, implementation, and validation work together.",
        "Software engineering methods connect the user problem to a working solution. Requirements define goals and acceptance criteria, design describes structure, implementation turns the plan into software, and validation checks whether it solves the original problem.\n\nThese stages repeat. When feedback reveals a new problem, the team revisits requirements and design rather than patching symptoms.",
        "A classmate suggests building a course app. Write one requirement for an AI coding agent, identifying the user, a key action, and one acceptance criterion. Then name one way you would validate it.",
      ),
      seedCourse(
        "software-basics",
        "Academic English Writing",
        "Develop clear arguments and confident academic prose.",
        "English",
        "Students preparing for academic writing",
        "Write a clear thesis statement supported by evidence.",
        "Academic writing starts with a clear claim. A thesis statement tells the reader what you will argue and why it matters. Each paragraph should support that claim with evidence, explanation, and a link back to the main argument.\n\nRevise for precision: replace vague words, define key terms, and check that every sentence advances the argument.",
        "Write a one-sentence thesis statement for a short academic paragraph about learning online. Then name one piece of evidence you would use to support it.",
      ),
      seedCourse(
        "product-skills",
        "Product Thinking and Decisions",
        "Create effective product strategies around real user needs.",
        "Business",
        "Beginners learning product decisions",
        "Prioritize a product decision using user value, risk, and cost.",
        "Discuss feature priorities by asking who benefits, how important the problem is, and how much effort validation requires.\n\nValidate the most critical assumptions first. Balance visual polish, feature count, and technical complexity against real user value.",
        "A learning platform is considering course search, AI-generated avatars, and saved learning progress. If there is time for only one, which would you choose? Explain the user scenario and your reasoning.",
      ),
    ],
    enrollments: [
      { courseId: "ai-coding", studentId: "demo-student", joinedAt: createdAt },
    ],
    submissions: [],
    feedback: [],
  };
}
