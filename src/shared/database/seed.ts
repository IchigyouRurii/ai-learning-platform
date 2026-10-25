import type {
  Activity,
  Course,
  CourseDraft,
  DemoState,
  Lesson,
  QuizQuestion,
} from "@/shared/contracts";

const createdAt = "2026-10-16T00:00:00.000Z";

function text(id: string, body: string): Lesson["blocks"][number] {
  return { id, type: "text", body };
}

function reflection(
  id: string,
  title: string,
  prompt: string,
  rubric: string,
): Lesson["blocks"][number] {
  return {
    id: `${id}-block`,
    type: "activity",
    activity: {
      id,
      type: "reflection",
      title,
      prompt,
      rubric,
    },
  };
}

function quiz(
  id: string,
  title: string,
  questions: QuizQuestion[],
): Lesson["blocks"][number] {
  return {
    id: `${id}-block`,
    type: "activity",
    activity: {
      id,
      type: "quiz",
      title,
      prompt: "Answer all five questions. Each has exactly one correct option.",
      rubric: "One point per correct answer.",
      questions,
    } satisfies Activity,
  };
}

function q(
  id: string,
  prompt: string,
  options: [string, string, string, string],
  correct: 0 | 1 | 2 | 3,
  explanation: string,
): QuizQuestion {
  const letters = ["a", "b", "c", "d"] as const;
  return {
    id,
    prompt,
    multiple: false,
    options: options.map((option, index) => ({
      id: `${id}-${letters[index]}`,
      text: option,
    })),
    correctOptionIds: [`${id}-${letters[correct]}`],
    explanation,
  };
}

function seedCourse(input: {
  id: string;
  title: string;
  description: string;
  subject: string;
  audience: string;
  goals: string[];
  lessons: Lesson[];
}): Course {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    subject: input.subject,
    audience: input.audience,
    goals: input.goals,
    ownerId: "demo-teacher",
    status: "published",
    visibility: "cohort",
    version: 1,
    createdAt,
    updatedAt: createdAt,
    draftRevision: 1,
    lessons: input.lessons,
  };
}

export function createSeedState(): DemoState {
  return {
    schemaVersion: 1,
    courses: [
      seedCourse({
        id: "ai-coding",
        title: "Communicating Requirements to AI",
        description:
          "Practice writing clear, testable requirements for effective collaboration with AI coding agents.",
        subject: "AI Programming",
        audience: "University students with no professional programming experience",
        goals: [
          "Identify the user, problem, and acceptance criteria in a requirement",
          "Write requirements that an AI coding agent can act on",
          "Review AI output against the original requirement",
        ],
        lessons: [
          {
            id: "ai-coding-l1",
            title: "Start with a real problem",
            blocks: [
              text(
                "ai-coding-t1",
                "An actionable requirement identifies the user, the problem, and how success will be checked. Without those three parts, an AI agent can produce code that looks correct but solves the wrong problem.\n\nFor example, a team task board lets members create tasks, assign owners, and mark completion. Tasks remain after the page refreshes. The requirement names the user (team members), the actions (create, assign, complete), and an observable success condition (tasks persist after refresh).\n\nWrite these criteria before asking an AI agent to implement the feature. Then check whether its proposed solution meets each criterion.",
              ),
              reflection(
                "ai-coding-r1",
                "Connect to your own experience",
                "Describe a situation where you would use an AI coding agent. What problem are you trying to solve, who is it for, and what would count as success?",
                "Look for a concrete situation, a named user, and an observable success criterion. Feedback should ask for one specific acceptance test.",
              ),
            ],
          },
          {
            id: "ai-coding-l2",
            title: "Turn goals into acceptance criteria",
            blocks: [
              text(
                "ai-coding-t2",
                "Acceptance criteria are short statements that can be checked without reading the implementation. Good criteria describe behaviour: \"A task marked complete stays complete after refresh\" or \"An empty title is rejected with a visible message.\"\n\nAvoid vague words such as fast, user-friendly, or robust unless you define how they will be measured. Split large goals into small criteria that can each be verified.\n\nWhen you work with an AI agent, put the criteria in the prompt and ask the agent to list which criteria its plan satisfies. Missing criteria reveal gaps before code is written.",
              ),
            ],
          },
          {
            id: "ai-coding-l3",
            title: "Check your understanding",
            blocks: [
              text(
                "ai-coding-t3",
                "Review the key ideas: start from a real user problem, state observable acceptance criteria, and verify AI output against them. The quiz below checks whether you can apply these ideas.",
              ),
              quiz("ai-coding-quiz", "Requirements checkpoint", [
                q(
                  "ai-coding-q1",
                  "What makes a requirement testable?",
                  [
                    "It states observable acceptance criteria",
                    "It uses confident language",
                    "It names a programming language",
                    "It is at least three paragraphs long",
                  ],
                  0,
                  "A requirement is testable when someone can check observable behaviour against stated criteria.",
                ),
                q(
                  "ai-coding-q2",
                  "What should you establish before asking an AI coding agent to implement a feature?",
                  [
                    "The user, the problem, and the success criteria",
                    "The agent's preferred code style",
                    "The exact number of lines of code",
                    "A list of every future feature",
                  ],
                  0,
                  "The requirement defines the target; implementation details come later.",
                ),
                q(
                  "ai-coding-q3",
                  "\"Tasks remain after the page refreshes\" is an example of:",
                  [
                    "An acceptance criterion",
                    "A design pattern",
                    "A deployment step",
                    "A performance benchmark",
                  ],
                  0,
                  "It states observable behaviour that can be checked without reading code.",
                ),
                q(
                  "ai-coding-q4",
                  "Why compare AI output with the original requirement?",
                  [
                    "To verify it solves the original problem, not merely produces code",
                    "To count how many files were created",
                    "To make the answer longer",
                    "To avoid writing any tests",
                  ],
                  0,
                  "Code can be syntactically valid yet miss the user's actual goal; the requirement is the reference.",
                ),
                q(
                  "ai-coding-q5",
                  "Which sentence is the strongest acceptance criterion?",
                  [
                    "An empty task title shows a visible error and is not saved",
                    "The form should feel modern",
                    "The app should be fast",
                    "The code should be clean",
                  ],
                  0,
                  "It describes a specific input, observable response, and data condition.",
                ),
              ]),
            ],
          },
        ],
      }),
      seedCourse({
        id: "software-basics",
        title: "Software Engineering Fundamentals",
        description:
          "Understand the relationship between requirements, design, implementation, and validation.",
        subject: "Software Engineering",
        audience: "Beginners exploring software development in the AI era",
        goals: [
          "Distinguish the user problem from its implementation",
          "Explain the role of requirements, design, implementation, and validation",
          "Propose a way to validate a small feature",
        ],
        lessons: [
          {
            id: "software-basics-l1",
            title: "From problem to software",
            blocks: [
              text(
                "software-basics-t1",
                "Software development starts with understanding a problem. Requirements define goals, design describes structure, implementation turns the plan into software, and validation checks whether it solves the original problem.\n\nThese stages repeat. When prototype feedback reveals a new problem, the team revisits requirements and design. A common mistake is to start writing code before agreeing on what success means.\n\nKeep the user's problem visible throughout. A feature that is technically impressive but does not change the user's situation has not delivered value.",
              ),
              reflection(
                "software-basics-r1",
                "Find the real problem",
                "A classmate suggests building a course app. What three questions would you ask to understand the real problem, and why?",
                "Look for questions about users, current pain, and success. Feedback should point out whether the questions separate the problem from a proposed solution.",
              ),
            ],
          },
          {
            id: "software-basics-l2",
            title: "Validate before you polish",
            blocks: [
              text(
                "software-basics-t2",
                "Validation is the activity of checking whether the software solves the problem. It can be as simple as a manual test with a realistic scenario or as formal as an automated suite.\n\nStart with the riskiest assumption. If learners will not return to a course page, polishing the visual design does not help. A small prototype and five user observations can answer that question faster than a month of implementation.\n\nWrite down what you expect to observe before running the test. Otherwise it is easy to explain away unexpected results after the fact.",
              ),
            ],
          },
          {
            id: "software-basics-l3",
            title: "Check your understanding",
            blocks: [
              text(
                "software-basics-t3",
                "The quiz below reviews the four stages, the role of iteration, and how to validate a small feature.",
              ),
              quiz("software-basics-quiz", "Fundamentals checkpoint", [
                q(
                  "software-basics-q1",
                  "Which sequence best describes the development cycle?",
                  [
                    "Requirements, design, implementation, validation",
                    "Implementation, requirements, design, validation",
                    "Design, validation, implementation, requirements",
                    "Validation, implementation, design, requirements",
                  ],
                  0,
                  "The cycle starts from understanding the problem, then design, build, and check.",
                ),
                q(
                  "software-basics-q2",
                  "What is the main purpose of requirements?",
                  [
                    "Define the goal and what success means",
                    "Choose the database vendor",
                    "Measure code coverage",
                    "Write the deployment script",
                  ],
                  0,
                  "Requirements capture the user problem and success conditions before implementation choices.",
                ),
                q(
                  "software-basics-q3",
                  "Validation asks:",
                  [
                    "Does the software solve the original problem?",
                    "Did we use the newest framework?",
                    "Is the code shorter than last time?",
                    "Did we finish on schedule?",
                  ],
                  0,
                  "Validation compares observed behaviour with the user problem and acceptance criteria.",
                ),
                q(
                  "software-basics-q4",
                  "Prototype feedback reveals a new user need. What should happen next?",
                  [
                    "Revisit requirements and design",
                    "Ignore the feedback until launch",
                    "Only change the colour scheme",
                    "Delete the prototype",
                  ],
                  0,
                  "The stages repeat; new evidence should update the requirements and design.",
                ),
                q(
                  "software-basics-q5",
                  "Which assumption should be tested first?",
                  [
                    "The one that would invalidate the most work if wrong",
                    "The easiest one to test",
                    "The one the team already believes",
                    "The one with the nicest dashboard",
                  ],
                  0,
                  "Testing the riskiest assumption early avoids building on a false premise.",
                ),
              ]),
            ],
          },
        ],
      }),
      seedCourse({
        id: "product-skills",
        title: "Product Thinking and Prioritization",
        description:
          "Choose a valuable next step for your team within limited time.",
        subject: "Product & Soft Skills",
        audience: "Students preparing for project work and internships",
        goals: [
          "Explain feature priorities using user value, risk, and cost",
          "Identify the riskiest assumption behind a feature",
          "Communicate a prioritization decision to a team",
        ],
        lessons: [
          {
            id: "product-skills-l1",
            title: "Value before features",
            blocks: [
              text(
                "product-skills-t1",
                "Discuss feature priorities by asking who benefits, how important the problem is, and how much effort validation requires.\n\nA long feature list is not a strategy. A useful question is: which change would most improve the life of a real user this week? Search, avatars, and saved progress may all be useful, but they do not serve the same user need.\n\nPrioritization is a conversation about trade-offs, not a vote on personal preferences. Name the user, the evidence, and the cost of being wrong.",
              ),
              reflection(
                "product-skills-r1",
                "Make a trade-off",
                "A learning platform can build course search, AI-generated avatars, or saved learning progress. If there is time for only one, which would you choose? Explain the user scenario and your reasoning.",
                "Look for a named user, a concrete scenario, and a comparison of value, risk, and cost. Feedback should ask what evidence would change the decision.",
              ),
            ],
          },
          {
            id: "product-skills-l2",
            title: "Validate the riskiest assumption",
            blocks: [
              text(
                "product-skills-t2",
                "Every feature rests on assumptions. For saved progress, the assumption may be that learners return often enough to need a record. For search, it may be that the catalog is large enough for browsing to fail.\n\nValidate the assumption that would invalidate the most work if it is wrong. Use the cheapest credible test: an interview, a clickable prototype, a manual concierge process, or a small analytics check.\n\nWrite the decision and the evidence in one short note. Future teammates need to know not only what was chosen, but why the alternatives were deferred.",
              ),
            ],
          },
          {
            id: "product-skills-l3",
            title: "Check your understanding",
            blocks: [
              text(
                "product-skills-t3",
                "The quiz below checks whether you can apply user value, risk, and cost to a prioritization decision.",
              ),
              quiz("product-skills-quiz", "Product thinking checkpoint", [
                q(
                  "product-skills-q1",
                  "What is the first question to ask about a proposed feature?",
                  [
                    "Who benefits, and what problem does it solve?",
                    "How many lines of code will it take?",
                    "Which competitor has it?",
                    "Can we finish it this afternoon?",
                  ],
                  0,
                  "User value and the underlying problem come before implementation cost.",
                ),
                q(
                  "product-skills-q2",
                  "Which assumption should be validated first?",
                  [
                    "The one that would invalidate the most work if wrong",
                    "The one that is easiest to demo",
                    "The one the loudest teammate prefers",
                    "The one with the largest estimated effort",
                  ],
                  0,
                  "Prioritize learning that changes the plan most.",
                ),
                q(
                  "product-skills-q3",
                  "A prioritization decision is strongest when it names:",
                  [
                    "The user, the evidence, and the trade-off",
                    "Only the deadline",
                    "Only the feature owner",
                    "The number of meetings held",
                  ],
                  0,
                  "A decision is communicable when its user value and trade-offs are explicit.",
                ),
                q(
                  "product-skills-q4",
                  "What is a cheap, credible way to test whether learners need saved progress?",
                  [
                    "Observe a small group returning to a manual prototype",
                    "Build the full database schema first",
                    "Ship it and wait a year",
                    "Ask only the project team",
                  ],
                  0,
                  "A small realistic observation tests the return-visit assumption before heavy investment.",
                ),
                q(
                  "product-skills-q5",
                  "What should a short decision note record?",
                  [
                    "What was chosen, why, and what was deferred",
                    "Only the final feature name",
                    "Every idea ever proposed",
                    "The team's favourite colour",
                  ],
                  0,
                  "Future teammates need the reasoning and the deferred alternatives, not just the outcome.",
                ),
              ]),
            ],
          },
        ],
      }),
    ],
    enrollments: [
      { courseId: "ai-coding", studentId: "demo-student", joinedAt: createdAt },
    ],
    submissions: [],
    feedback: [],
    learningPaths: [],
  };
}

export function seedCourseDrafts(): CourseDraft[] {
  return createSeedState().courses.map(
    ({ title, description, subject, audience, goals, lessons }) => ({
      title,
      description,
      subject,
      audience,
      goals,
      lessons,
    }),
  );
}
