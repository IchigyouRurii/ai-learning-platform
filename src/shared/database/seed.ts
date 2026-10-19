import type { Course, DemoState } from "@/shared/contracts";

const createdAt = "2026-10-16T00:00:00.000Z";
function seedCourse(
  id: string,
  title: string,
  description: string,
  subject: string,
  goal: string,
  body: string,
  prompt: string,
): Course {
  return {
    id,
    title,
    description,
    subject,
    audience: "Beginners exploring software development in the AI era",
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
        "Communicating Requirements to AI",
        "Practice writing clear requirements for effective collaboration with AI coding agents.",
        "Computer Science",
        "Write requirements that identify users, goals, and acceptance criteria.",
        "An actionable requirement identifies the user, the problem, and how success will be checked.\n\nFor example, a team task board lets members create tasks, assign owners, and mark completion. Tasks remain after the page refreshes.\n\nWrite these criteria before asking an AI agent to implement the feature. Then check whether its proposed solution meets the goals.",
        "Your team needs a study check-in tool. Write a requirement for an AI coding agent, identifying users, key actions, and at least one acceptance criterion.",
      ),
      seedCourse(
        "software-basics",
        "Software Engineering Fundamentals",
        "Understand the relationship between requirements, design, implementation, and validation.",
        "Computer Science",
        "Distinguish the user problem from its implementation and propose a way to validate the solution.",
        "Software development starts with understanding a problem. Requirements define goals, design describes structure, implementation turns the plan into software, and validation checks whether it solves the original problem.\n\nThese stages repeat. When prototype feedback reveals new problems, the team revisits requirements and design.",
        "A classmate suggests building a course app. What three questions would you ask to understand the real problem, and why?",
      ),
      seedCourse(
        "product-skills",
        "Product Thinking and Prioritization",
        "Choose a valuable next step for your team within limited time.",
        "Business",
        "Explain feature priorities using user value, risk, and cost.",
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
