import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createTranslationRegistry,
  startInterfaceTranslation,
} from "@/shared/i18n/page-translator";

type Node = {
  data: string;
  readonly textContent: string;
  isConnected: boolean;
  parentElement: { closest: (selector: string) => string | null };
};

let observer: MutationCallback | undefined;

function page(nodes: Node[], attributes: Record<string, string>[] = []) {
  const elements = attributes.map((values) => ({
    isConnected: true,
    values,
    closest: () => null,
    getAttribute: (name: string) => values[name] ?? null,
    setAttribute: (name: string, value: string) => {
      values[name] = value;
    },
  }));
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: MutationCallback) {
        observer = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("document", {
    body: { querySelectorAll: () => elements },
    createTreeWalker: () => {
      let index = -1;
      return {
        get currentNode() {
          return nodes[index];
        },
        nextNode: () => ++index < nodes.length,
      };
    },
  });
  return nodes;
}

function text(
  data: string,
  closest: (selector: string) => string | null = () => null,
): Node {
  return {
    data,
    get textContent() {
      return this.data;
    },
    isConnected: true,
    parentElement: { closest },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  observer = undefined;
});

it("switches known interface copy in both directions", () => {
  const [node] = page([text("Password")]);
  const registry = createTranslationRegistry();
  const stopChinese = startInterfaceTranslation({ locale: "zh", registry });
  expect(node.data).toBe("密码");
  stopChinese();
  const stopEnglish = startInterfaceTranslation({ locale: "en", registry });
  expect(node.data).toBe("Password");
  stopEnglish();
});

it("keeps course text, code and editable content in their original language", () => {
  const [course, code, known] = page([
    text("A private lesson body"),
    text("Password", (selector) => (selector.includes("pre") ? "pre" : null)),
    text("Welcome back to OpenLearnING"),
  ]);
  startInterfaceTranslation({
    locale: "zh",
    registry: createTranslationRegistry(),
  });
  expect(course.data).toBe("A private lesson body");
  expect(code.data).toBe("Password");
  expect(known.data).toBe("欢迎回到 OpenLearnING");
});

it("translates attributes such as placeholders", () => {
  const values: Record<string, string> = {
    placeholder: "Enter your password",
  };
  page([], [values]);
  startInterfaceTranslation({
    locale: "zh",
    registry: createTranslationRegistry(),
  });
  expect(values.placeholder).toBe("输入密码");
});

it("refills text that React re-renders after the first pass", async () => {
  const [node] = page([text("Password")]);
  startInterfaceTranslation({
    locale: "zh",
    registry: createTranslationRegistry(),
  });
  expect(node.data).toBe("密码");
  node.data = "Email";
  observer?.(
    [{ type: "characterData", target: node } as unknown as MutationRecord],
    {
      observe() {},
      disconnect() {},
      takeRecords: () => [],
    } as unknown as MutationObserver,
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(node.data).toBe("邮箱");
});
