import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  FeatureInput,
  FeatureResult,
  Classroom,
  User,
} from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";

const external = vi.hoisted(() => ({ database: vi.fn(), ai: vi.fn() }));
vi.mock("@/shared/database", () => ({ getRepository: external.database }));
vi.mock("@/shared/ai/client", () => ({ complete: external.ai }));
import {
  platformExtensions,
  getExtensionCapabilities,
} from "@/modules/platform/server/extensions";
import { extensionDefinitions } from "@/modules/platform/server/extensions/definitions";

type Inputs = {
  [D in keyof typeof extensionDefinitions]: {
    [
      K in keyof (typeof extensionDefinitions)[D]
    ]: (typeof extensionDefinitions)[D][K] extends import("@/shared/contracts").FeatureDefinition
      ? FeatureInput<(typeof extensionDefinitions)[D][K]>
      : never;
  };
};
const content = { course: createSeedState().courses[0], activities: [] };
const path = {
  title: "入门",
  steps: [
    {
      courseId: "course",
      courseVersion: 1,
      order: 0,
      targetMinutes: 30,
      reason: "基础",
    },
  ],
};
const profile = {
  background: "初学者",
  goals: ["学习需求分析"],
  difficulty: "beginner" as const,
  availableMinutesPerWeek: 120,
};
const reference = {
  courseId: "course",
  courseVersion: 1,
  activityId: "activity",
};
const generation = { topic: "需求分析", audience: "初学者", goals: "说明需求" };
const key = "d7b59eb2-2266-4f8b-a0c3-e31b994f24bd";
const inputs = {
  classrooms: {
    create: { name: "一班" },
    listMine: {},
    listMembers: { classId: "class" },
    inviteStudents: { classId: "class", emails: ["student@example.com"] },
    importStudents: { classId: "class", emails: ["student@example.com"] },
    acceptInvitation: { token: "a".repeat(32) },
    joinByCode: { code: "ABC123" },
    createJoinCode: { classId: "class" },
    removeMember: { classId: "class", studentId: "student" },
    assignCourse: { classId: "class", courseId: "course", courseVersion: 1 },
    listAssignments: {},
  },
  courseManagement: {
    listCatalog: {},
    listMine: {},
    getEditor: { courseId: "course" },
    createPersonal: { content },
    updateDraft: { courseId: "course", expectedDraftRevision: 1, content },
    publishRevision: { courseId: "course", expectedDraftRevision: 1 },
    listRevisions: { courseId: "course" },
    getRevisionForAuthor: { courseId: "course", version: 1 },
  },
  generation: {
    generateDraft: generation,
    rewritePart: {
      courseId: "course",
      expectedDraftRevision: 1,
      target: { type: "text", lessonId: "lesson", blockId: "block" },
      instruction: "解释得具体一些",
    },
    startCourseJob: generation,
    getJob: { jobId: "job" },
  },
  learning: {
    getCourse: { courseId: "course", courseVersion: 1 },
    getActivity: reference,
    completeLesson: {
      courseId: "course",
      courseVersion: 1,
      lessonId: "lesson",
    },
    submitAttempt: {
      ...reference,
      idempotencyKey: key,
      response: { type: "reflection", text: "我的回答" },
    },
    listAttempts: { courseId: "course", courseVersion: 1 },
    listStudentAttempts: {
      classId: "class",
      studentId: "student",
      courseId: "course",
      courseVersion: 1,
    },
    getMyProgress: { courseId: "course", courseVersion: 1 },
    getStudentProgress: {
      classId: "class",
      studentId: "student",
      courseId: "course",
      courseVersion: 1,
    },
    getClassProgress: { classId: "class", assignmentId: "assignment" },
    startRoleplay: reference,
    sendRoleplayMessage: {
      sessionId: "session",
      message: "你好",
      idempotencyKey: key,
    },
    finishRoleplay: { sessionId: "session" },
  },
  learningProfiles: { getMine: {}, updateMine: profile },
  learningPaths: {
    generate: profile,
    save: { path },
    listMine: {},
    getMine: { pathId: "path" },
  },
  materials: {
    requestUpload: {
      filename: "notes.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    },
    confirmUpload: { materialId: "material" },
    listMine: {},
    getReadUrl: { materialId: "material" },
  },
  discussions: {
    ask: { courseId: "course", courseVersion: 1, message: "请解释这个概念" },
    listThreads: { courseId: "course" },
    getThread: { questionId: "question" },
    reply: { questionId: "question", message: "可以这样理解" },
    resolve: { questionId: "question" },
  },
  administration: {
    listUsers: {},
    changeRole: { userId: "user", expectedRole: "student", role: "teacher" },
    listCourses: {},
    withdrawCourse: { courseId: "course", reason: "内容需要修正" },
  },
  accountProfiles: { getMine: {}, updateMine: { name: "小林" } },
} satisfies Inputs;
const actor: User = { id: "actor", name: "测试用户", role: "teacher" };

describe("reserved service boundaries", () => {
  it("has a validated, fail-closed entry point for every declared operation without calling external systems", async () => {
    let count = 0;
    for (const [domain, definitions] of Object.entries(extensionDefinitions)) {
      const service = platformExtensions[
        domain as keyof typeof platformExtensions
      ] as unknown as Record<
        string,
        (actor: User | null, input: unknown) => Promise<FeatureResult<unknown>>
      >;
      const examples = inputs[domain as keyof typeof inputs] as Record<
        string,
        unknown
      >;
      for (const [name, definition] of Object.entries(definitions)) {
        expect(
          definition.input.safeParse(examples[name]).success,
          `${domain}.${name}`,
        ).toBe(true);
        expect(
          await service[name](
            { ...actor, role: definition.roles[0] },
            examples[name],
          ),
        ).toMatchObject({ ok: false, code: "NOT_IMPLEMENTED" });
        expect(await service[name](null, examples[name])).toMatchObject({
          ok: false,
          code: "AUTH_REQUIRED",
        });
        const denied = (["teacher", "student", "admin"] as const).find(
          (role) => !definition.roles.includes(role),
        );
        if (denied)
          expect(
            await service[name]({ ...actor, role: denied }, examples[name]),
          ).toMatchObject({ ok: false, code: "FORBIDDEN" });
        count++;
      }
    }
    expect(getExtensionCapabilities()).toHaveLength(count);
    expect(
      getExtensionCapabilities().every((item) => item.status === "reserved"),
    ).toBe(true);
    expect(external.database).not.toHaveBeenCalled();
    expect(external.ai).not.toHaveBeenCalled();
  });
  it("rejects invalid input and authority injection before returning a reserved result", async () => {
    expect(
      await platformExtensions.classrooms.create(actor, { name: "" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    const forged = { name: "一班", teacherId: "other" };
    expect(
      await platformExtensions.classrooms.create(actor, forged),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await platformExtensions.administration.changeRole(
        { ...actor, role: "student" },
        inputs.administration.changeRole,
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      await platformExtensions.accountProfiles.updateMine(actor, {
        name: "小林",
        role: "admin",
      } as { name: string }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
  it("retains concrete return types for frontend and backend collaborators", () => {
    expectTypeOf<
      Awaited<ReturnType<typeof platformExtensions.classrooms.create>>
    >().toEqualTypeOf<FeatureResult<Classroom>>();
  });
});
