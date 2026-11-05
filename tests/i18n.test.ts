import { describe, expect, it } from "vitest";
import { translate } from "../src/shared/i18n/messages";

describe("interface translations", () => {
  it("switches interface copy without changing the English source", () => {
    expect(translate("Course Marketplace", "zh")).toBe("课程广场");
    expect(translate("Course Marketplace", "en")).toBe("Course Marketplace");
  });
  it("preserves JSX spacing and falls back for unknown copy", () => {
    expect(translate("  Your name\n", "zh")).toBe("  你的姓名\n");
    expect(translate("A custom course title", "zh")).toBe(
      "A custom course title",
    );
  });
  it("translates labels that embed a value", () => {
    expect(translate("Option 2", "zh")).toBe("选项 2");
    expect(translate("· Published v3", "zh")).toBe("· 已发布 v3");
    expect(translate("Added 2 students.", "zh")).toBe("已添加 2 名学生。");
    expect(translate("Answer all 3 questions to submit.", "zh")).toBe(
      "请回答全部 3 道题后提交。",
    );
    expect(
      translate(
        "Currently enrolled: beginner. Switch difficulty to start this learning route.",
        "zh",
      ),
    ).toBe("当前已加入：入门。切换难度以开始此学习路线。");
  });
});
