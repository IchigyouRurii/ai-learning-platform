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
    audience: "希望了解 AI 时代软件开发的初学者",
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
        title: "从一个真实问题开始",
        blocks: [
          { id: `${id}-text`, type: "text", body },
          {
            id: `${id}-block`,
            type: "activity",
            activity: {
              id: `${id}-activity-1`,
              type: "reflection",
              title: "轮到你来试一试",
              prompt,
              rubric:
                "回答应具体描述场景，解释自己的判断，并提出可验证的下一步。优先给出引导，而非代替学生完成任务。",
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
        "把想法说清楚，再让 AI 写代码",
        "用一个需求描述练习，学习与 AI 编程代理有效协作。",
        "AI 编程协作",
        "能写出包含用户、目标和验收条件的需求描述。",
        "一个可执行的需求，要说明谁会使用、遇到了什么问题，以及怎样判断问题被解决。\n\n例如：为课程小组制作任务板。组员可以创建任务、指定负责人并标记完成；刷新页面后任务仍然保留。\n\n向 AI 提需求前，先把这些条件写下来，再检查它提出的实现方案是否覆盖了目标。",
        "你的小组需要一个学习打卡工具。请为 AI 编程代理写一段需求，说明用户、主要行为与至少一个验收条件。",
      ),
      seedCourse(
        "software-basics",
        "从用户问题走到软件方案",
        "认识需求、设计、实现与验证之间的关系。",
        "软件工程基础",
        "能区分用户问题和具体实现，并给出验证方法。",
        "软件开发从理解问题开始。需求说明目标，设计解释结构，实现把方案变成程序，验证检查程序能否解决原来的问题。\n\n这几个阶段会反复发生。原型试用后发现新问题，团队就需要回到需求和设计继续调整。",
        "有同学提出‘做一个课程 App’。为了理解真正的问题，你会向他询问哪三个问题？为什么？",
      ),
      seedCourse(
        "product-skills",
        "先做哪个功能？",
        "在有限时间内，为团队选择有价值的下一步。",
        "产品与沟通",
        "能用用户价值、风险与成本说明功能优先级。",
        "功能优先级可以从三个角度讨论：帮助了谁、解决的问题有多重要、验证它需要多少工作。\n\n团队应先验证最关键的假设。界面美化、功能数量和技术复杂度，都需要与实际用户价值一起权衡。",
        "一个学习平台准备增加：课程搜索、AI 生成头像、学习进度保存。假设时间只够做一项，你会先做什么？请说明用户场景与理由。",
      ),
    ],
    enrollments: [
      { courseId: "ai-coding", studentId: "demo-student", joinedAt: createdAt },
    ],
    submissions: [],
    feedback: [],
  };
}
