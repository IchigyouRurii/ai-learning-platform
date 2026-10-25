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
      "AI_PROVIDER must be mock, openrouter, or openai-compatible.",
    );
  return provider;
}

function configuration() {
  const provider = getAIProvider();
  if (provider === "mock")
    throw new Error(
      "Mock mode must use sample results from the business module.",
    );
  const key = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!key || !model)
    throw new Error(
      "Set AI_API_KEY and AI_MODEL in the root .env, then restart the server.",
    );
  const freeOnly =
    process.env.AI_FREE_ONLY ?? (provider === "openrouter" ? "true" : "false");
  if (freeOnly !== "true" && freeOnly !== "false")
    throw new Error("AI_FREE_ONLY must be true or false.");
  if (
    provider === "openrouter" &&
    freeOnly === "true" &&
    !model.endsWith(":free") &&
    model !== "openrouter/free"
  )
    throw new Error(
      "Only explicit OpenRouter free routes are allowed. Use a full model ID ending in :free. Paid models require explicitly setting AI_FREE_ONLY=false.",
    );
  const jsonMode =
    process.env.AI_JSON_MODE ??
    (provider === "openrouter" ? "prompt" : "json_object");
  if (jsonMode !== "prompt" && jsonMode !== "json_object")
    throw new Error("AI_JSON_MODE must be prompt or json_object.");
  const base =
    process.env.AI_BASE_URL?.trim() ||
    (provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1");
  let url: URL;
  try {
    url = new URL(`${base.replace(/\/+$/, "")}/chat/completions`);
  } catch {
    throw new Error("AI_BASE_URL is not a valid service URL.");
  }
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "AI_BASE_URL must be an API base URL without credentials or query parameters.",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("AI services require HTTPS. Local models may use HTTP.");
  if (
    provider === "openrouter" &&
    (!["openrouter.ai", "eu.openrouter.ai"].includes(url.hostname) ||
      url.pathname !== "/api/v1/chat/completions")
  )
    throw new Error(
      "OpenRouter requires AI_BASE_URL=https://openrouter.ai/api/v1.",
    );
  return { provider, key, model, jsonMode, url };
}

function serviceError(status: number): Error {
  switch (status) {
    case 401:
      return new Error(
        "The AI API key is invalid or expired. Check AI_API_KEY.",
      );
    case 402:
      return new Error(
        "Insufficient AI balance or quota. Check your account and model terms.",
      );
    case 403:
      return new Error(
        "Your account cannot access this model. Check model permissions and account settings.",
      );
    case 404:
      return new Error(
        "Model or API endpoint not found. Check AI_MODEL and AI_BASE_URL.",
      );
    case 429:
      return new Error(
        "Model rate limit or quota reached. Try again later or choose another available free model.",
      );
    case 400:
    case 422:
      return new Error(
        "Incompatible model or request parameters. Check the model ID; course generation supports AI_JSON_MODE=prompt.",
      );
    case 502:
    case 503:
      return new Error(
        "This model is temporarily unavailable. Try again later or select another model.",
      );
    default:
      return new Error(
        `AI service temporarily unavailable (HTTP ${status}). Please try again later.`,
      );
  }
}

export async function complete(
  messages: Message[],
  json = false,
  options: { maxTokens?: number; temperature?: number } = {},
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
        max_tokens: options.maxTokens ?? (json ? 6000 : 1000),
        ...(options.temperature === undefined
          ? {}
          : { temperature: options.temperature }),
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
    throw new Error(
      "AI connection failed or timed out. Please try again later.",
    );
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
    throw new Error("Invalid AI response format. Please try again later.");
  }
  if (!result || typeof result !== "object")
    throw new Error("The AI service returned no valid response.");
  if (result.error)
    throw serviceError(
      typeof result.error.code === "number" ? result.error.code : 502,
    );
  const choice = result.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new Error(
      "Model output was truncated. Shorten the materials or reduce the scope and retry.",
    );
  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal)
    throw new Error(
      "The model could not complete the request. Adjust the topic or input and retry.",
    );
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error(
      "The model returned no usable text. Retry or select another model.",
    );
  return content;
}
