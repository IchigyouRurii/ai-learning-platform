import { describe, expect, it } from "vitest";
import {
  authoringActivitySchema,
  authoringDraftSchema,
  activityResponseSchema,
  courseManagementFeatures,
  generationRequestSchema,
  learningPathDraftSchema,
  learnerActivitySchema,
  learnerCourseSchema,
  progressViewSchema,
  rewriteSuggestionSchema,
  toLearnerActivity,
} from "@/shared/contracts/features";
import { createSeedState } from "@/shared/database/seed";

const quiz = {
  learner: {
    id: "quiz-1",
    type: "quiz" as const,
    title: "需求判断",
    prompt: "选择正确描述",
    questions: [
      {
        id: "q1",
        prompt: "哪项能验收？",
        multiple: false,
        options: [
          { id: "a", text: "好用" },
          { id: "b", text: "能保存记录" },
        ],
      },
    ],
  },
  evaluation: {
    rubric: "按答案判分",
    answerKey: [
      {
        questionId: "q1",
        correctOptionIds: ["b"],
        explanation: "描述可观察的结果",
        points: 10,
      },
    ],
    privateInstructions: "教师私有说明",
  },
};

describe("complete feature data contracts", () => {
  it("requires quiz answer keys to match unique questions and valid options", () => {
    expect(authoringActivitySchema.safeParse(quiz).success).toBe(true);
    expect(
      authoringActivitySchema.safeParse({
        ...quiz,
        evaluation: { rubric: "评价" },
      }).success,
    ).toBe(false);
    expect(
      authoringActivitySchema.safeParse({
        ...quiz,
        evaluation: {
          ...quiz.evaluation,
          answerKey: [
            { ...quiz.evaluation.answerKey[0], correctOptionIds: ["missing"] },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      authoringActivitySchema.safeParse({
        ...quiz,
        learner: {
          ...quiz.learner,
          questions: [quiz.learner.questions[0], quiz.learner.questions[0]],
        },
      }).success,
    ).toBe(false);
    expect(
      authoringActivitySchema.safeParse({
        ...quiz,
        evaluation: {
          ...quiz.evaluation,
          answerKey: [
            { ...quiz.evaluation.answerKey[0], correctOptionIds: ["a", "b"] },
          ],
        },
      }).success,
    ).toBe(false);
  });
  it("projects authoring configuration into learner data without answer keys or private instructions", () => {
    const parsed = authoringActivitySchema.parse(quiz);
    const learner = toLearnerActivity(parsed);
    expect(learner.type).toBe("quiz");
    expect(JSON.stringify(learner)).not.toContain("answerKey");
    expect(JSON.stringify(learner)).not.toContain("教师私有说明");
    expect(
      learnerActivitySchema.parse({ ...learner, evaluation: quiz.evaluation }),
    ).not.toHaveProperty("evaluation");
    const course = createSeedState().courses[0];
    const view = learnerCourseSchema.parse({
      ...course,
      evaluation: quiz.evaluation,
      lessons: [
        {
          id: "lesson",
          title: "练习",
          blocks: [
            {
              type: "activity",
              id: "block",
              activity: { ...learner, evaluation: quiz.evaluation },
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(view)).not.toContain("answerKey");
    expect(JSON.stringify(view)).not.toContain("privateInstructions");
  });
  it("requires advanced activity configuration to match the embedded activity and type", () => {
    const course = structuredClone(createSeedState().courses[0]);
    const block = course.lessons[0].blocks.find((b) => b.type === "activity")!;
    if (block.type !== "activity") throw new Error("fixture");
    block.activity = {
      id: "quiz-1",
      type: "quiz",
      title: "测验",
      prompt: "请选择",
      rubric: "按答案判分",
    };
    expect(
      authoringDraftSchema.safeParse({ course, activities: [quiz] }).success,
    ).toBe(true);
    expect(
      authoringDraftSchema.safeParse({ course, activities: [] }).success,
    ).toBe(false);
    expect(
      authoringDraftSchema.safeParse({
        course,
        activities: [{ ...quiz, learner: { ...quiz.learner, id: "other" } }],
      }).success,
    ).toBe(false);
    expect(
      authoringDraftSchema.safeParse({ course, activities: [quiz, quiz] })
        .success,
    ).toBe(false);
  });
  it("preserves legacy reflection courses while rejecting forged authority and scores", () => {
    expect(
      authoringDraftSchema.safeParse({ course: createSeedState().courses[0] })
        .success,
    ).toBe(true);
    expect(
      courseManagementFeatures.createPersonal.input.safeParse({
        content: { course: createSeedState().courses[0] },
        ownerId: "other",
      }).success,
    ).toBe(false);
    expect(
      activityResponseSchema.safeParse({
        type: "quiz",
        answers: [{ questionId: "q1", selectedOptionIds: ["b"] }],
        score: 100,
      }).success,
    ).toBe(false);
    expect(
      courseManagementFeatures.updateDraft.input.safeParse({
        courseId: "course",
        expectedDraftRevision: 0,
        content: { course: createSeedState().courses[0] },
      }).success,
    ).toBe(false);
  });
  it("validates time budgets and unambiguous course order in a learning path", () => {
    const step = {
      courseId: "course",
      courseVersion: 1,
      order: 0,
      targetMinutes: 30,
      reason: "入门基础",
    };
    expect(
      learningPathDraftSchema.safeParse({ title: "学习计划", steps: [step] })
        .success,
    ).toBe(true);
    expect(
      learningPathDraftSchema.safeParse({
        title: "学习计划",
        steps: [step, { ...step, courseId: "other" }],
      }).success,
    ).toBe(false);
    expect(
      learningPathDraftSchema.safeParse({
        title: "学习计划",
        steps: [step, { ...step, order: 1 }],
      }).success,
    ).toBe(false);
    expect(
      learningPathDraftSchema.safeParse({
        title: "学习计划",
        steps: [{ ...step, targetMinutes: -1 }],
      }).success,
    ).toBe(false);
  });
  it("requires a rewrite to match its requested target and preserve stable IDs", () => {
    const base = {
      courseId: "course",
      baseDraftRevision: 1,
      target: { type: "activity", activityId: "quiz-1" },
    };
    expect(
      rewriteSuggestionSchema.safeParse({
        ...base,
        replacement: { type: "activity", activity: quiz },
      }).success,
    ).toBe(true);
    expect(
      rewriteSuggestionSchema.safeParse({
        ...base,
        replacement: { type: "text", body: "文本" },
      }).success,
    ).toBe(false);
    expect(
      rewriteSuggestionSchema.safeParse({
        ...base,
        target: { type: "activity", activityId: "other" },
        replacement: { type: "activity", activity: quiz },
      }).success,
    ).toBe(false);
  });
  it("bounds model input and does not accept caller-supplied ownership", () => {
    const input = {
      topic: "需求描述",
      audience: "初学者",
      goals: "描述验收条件",
    };
    expect(generationRequestSchema.parse(input).difficulty).toBe("beginner");
    expect(
      generationRequestSchema.safeParse({
        ...input,
        materials: "x".repeat(20001),
      }).success,
    ).toBe(false);
    expect(
      generationRequestSchema.safeParse({ ...input, ownerId: "other" }).success,
    ).toBe(false);
  });
  it("rejects repeated answers and impossible score totals", () => {
    const answer = { questionId: "q1", selectedOptionIds: ["b"] };
    expect(
      activityResponseSchema.safeParse({
        type: "quiz",
        answers: [answer, answer],
      }).success,
    ).toBe(false);
    expect(
      activityResponseSchema.safeParse({
        type: "quiz",
        answers: [{ ...answer, selectedOptionIds: ["b", "b"] }],
      }).success,
    ).toBe(false);
    const progress = {
      courseId: "course",
      courseVersion: 1,
      studentId: "student",
      completedLessons: 1,
      totalLessons: 2,
      submittedActivities: 1,
      totalActivities: 2,
      score: 10,
      maxScore: 10,
    };
    expect(progressViewSchema.safeParse(progress).success).toBe(true);
    expect(
      progressViewSchema.safeParse({ ...progress, score: 11 }).success,
    ).toBe(false);
    expect(
      progressViewSchema.safeParse({ ...progress, maxScore: null }).success,
    ).toBe(false);
  });
});
