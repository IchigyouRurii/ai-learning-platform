import "server-only";

type Message = { role: "system" | "user"; content: string };
type Provider = "mock" | "openai-compatible" | "openrouter";

export function getAIProvider(): Provider {
  const provider = process.env.AI_PROVIDER ?? "mock";
  if (
    provider !== "mock" &&
    provider !== "openai-compatible" &&
    provider !== "openrouter"
  )
    throw new Error(
      "AI_PROVIDER 只能为 mock、openrouter 或 openai-compatible。",
    );
  return provider;
}

function configuration() {
  const provider = getAIProvider();
  if (provider === "mock")
    throw new Error("模拟模式应由业务模块返回自己的示例结果。");
  const key = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!key || !model)
    throw new Error(
      "请在根目录 .env 填写 AI_API_KEY 和 AI_MODEL，保存后重启服务。",
    );
  const freeOnly =
    process.env.AI_FREE_ONLY ?? (provider === "openrouter" ? "true" : "false");
  if (freeOnly !== "true" && freeOnly !== "false")
    throw new Error("AI_FREE_ONLY 只能为 true 或 false。");
  if (
    provider === "openrouter" &&
    freeOnly === "true" &&
    !model.endsWith(":free") &&
    model !== "openrouter/free"
  )
    throw new Error(
      "当前仅允许 OpenRouter 显式免费路由。请填写以 :free 结尾的完整模型 ID；如需付费模型，先明确将 AI_FREE_ONLY 改为 false。",
    );
  const jsonMode =
    process.env.AI_JSON_MODE ??
    (provider === "openrouter" ? "prompt" : "json_object");
  if (jsonMode !== "prompt" && jsonMode !== "json_object")
    throw new Error("AI_JSON_MODE 只能为 prompt 或 json_object。");
  const base =
    process.env.AI_BASE_URL?.trim() ||
    (provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1");
  let url: URL;
  try {
    url = new URL(`${base.replace(/\/+$/, "")}/chat/completions`);
  } catch {
    throw new Error("AI_BASE_URL 不是有效的服务地址。");
  }
  if (url.username || url.password || url.search || url.hash)
    throw new Error("AI_BASE_URL 应填写不含密钥或查询参数的 API 基础地址。");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("AI 服务地址需要使用 HTTPS；本地模型可使用 HTTP。");
  if (
    provider === "openrouter" &&
    (!["openrouter.ai", "eu.openrouter.ai"].includes(url.hostname) ||
      url.pathname !== "/api/v1/chat/completions")
  )
    throw new Error(
      "OpenRouter 模式请使用 AI_BASE_URL=https://openrouter.ai/api/v1。",
    );
  return { provider, key, model, jsonMode, url };
}

function serviceError(status: number): Error {
  switch (status) {
    case 401:
      return new Error("AI API Key 无效或已过期，请检查 AI_API_KEY。");
    case 402:
      return new Error(
        "AI 服务提示账户余额或额度不足，请检查账户状态和模型使用条件。",
      );
    case 403:
      return new Error("当前账户无权使用这个模型，请检查模型权限及账户设置。");
    case 404:
      return new Error(
        "没有找到这个模型或 API 地址，请核对完整的 AI_MODEL 和 AI_BASE_URL。",
      );
    case 429:
      return new Error(
        "模型请求达到限流或使用额度，请稍后重试，或选择另一个可用免费模型。",
      );
    case 400:
    case 422:
      return new Error(
        "模型或请求参数不兼容，请核对模型 ID；课程生成可使用 AI_JSON_MODE=prompt。",
      );
    case 502:
    case 503:
      return new Error("当前模型暂时不可用，请稍后重试或选择另一个可用模型。");
    default:
      return new Error(`AI 服务暂时不可用（HTTP ${status}），请稍后重试。`);
  }
}

export async function complete(
  messages: Message[],
  json = false,
): Promise<string> {
  const { provider, key, model, jsonMode, url } = configuration();
  // OpenRouter's free models have different structured-output capabilities.
  // Prompt mode relies on business prompts + local schema validation, without
  // silently retrying, changing models or falling back to paid providers.
  const structured = json && jsonMode === "json_object";
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: json ? 5000 : 1000,
        ...(structured
          ? {
              response_format: { type: "json_object" },
              ...(provider === "openrouter"
                ? { provider: { require_parameters: true } }
                : {}),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(90000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new Error("AI 服务连接失败或超时，请稍后重试。");
  }
  if (!response.ok) throw serviceError(response.status);
  let result: {
    error?: { code?: number };
    choices?: {
      finish_reason?: string;
      message?: { content?: string | null; refusal?: string | null };
    }[];
  };
  try {
    result = await response.json();
  } catch {
    throw new Error("AI 服务返回的响应格式不正确，请稍后重试。");
  }
  if (!result || typeof result !== "object")
    throw new Error("AI 服务没有返回有效响应。");
  if (result.error)
    throw serviceError(
      typeof result.error.code === "number" ? result.error.code : 502,
    );
  const choice = result.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new Error(
      "模型输出达到长度限制，内容未完成。请缩短材料或减少生成范围后重试。",
    );
  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal)
    throw new Error("模型未能完成这次请求，请调整教学主题或输入内容后重试。");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error("模型没有返回可用文本，请重试或选择另一个模型。");
  return content;
}
