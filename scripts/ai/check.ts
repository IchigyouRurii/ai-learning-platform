import { createRequire } from "node:module";
import { complete, getAIProvider } from "../../src/shared/ai/client";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env") as {
  loadEnvConfig: (directory: string, development?: boolean) => unknown;
};
loadEnvConfig(process.cwd(), true);

try {
  if (getAIProvider() === "mock")
    throw new Error(
      "请先在 .env 将 AI_PROVIDER 设为 openrouter 并填写模型 ID 与密钥。",
    );
  const result = await complete([
    {
      role: "system",
      content:
        "你正在执行一次连接检查。请只用一句中文回复，不输出推理或长篇解释。",
    },
    { role: "user", content: "请回复：AI 服务连接成功。" },
  ]);
  console.log("AI 请求成功，模型返回：");
  console.log(result.trim().slice(0, 160));
} catch (error) {
  console.error(error instanceof Error ? error.message : "AI 连接检查失败。");
  process.exitCode = 1;
}
