# OpenRouter 接入

OpenRouter 通过兼容 Chat Completions 的接口提供多个模型。项目直接使用服务端 fetch，不新增 SDK，不把 API Key 暴露给浏览器。

## 配置

所有项目配置继续放在根目录唯一的 `.env`：

| 变量         | 值或用途                                                |
| ------------ | ------------------------------------------------------- |
| AI_PROVIDER  | `openrouter`                                            |
| AI_BASE_URL  | `https://openrouter.ai/api/v1`                          |
| AI_MODEL     | 模型页面复制的完整 API ID；显式免费变体通常包含 `:free` |
| AI_API_KEY   | OpenRouter API Key，仅供服务端读取                      |
| AI_FREE_ONLY | 默认 `true`，只接受 `:free` 或 `openrouter/free` 路由   |
| AI_JSON_MODE | 默认 `prompt`；明确支持 JSON 输出时才选 `json_object`   |

选择具体模型的免费变体更便于团队比较同一模型的结果。`openrouter/free` 也是可接受的免费路由，但实际选择的模型可能变化。当前不替用户选择某个模型，也不默认填写一个可能已失效的免费模型 ID。

修改配置后重启开发服务器。不要在聊天、截图或 Git 提交中暴露密钥。

## 不依赖 Neon 的连接检查

```bash
bash scripts/local.sh ai:check
```

脚本读取同一份 `.env`，发送一次简短的静态请求并打印少量模型回复。不会读取课程或学生数据，不会连接数据库。只配置 OpenRouter 后就能先测试 AI；要在网页使用课程功能，仍需完成 Neon 初始化和登录。

## 两端如何使用

- 教师课程生成：业务提示词要求课程结构，收到结果后校验。兼容单个 JSON 代码块包装，不接受附带任意解释或不完整的 JSON。
- 学生活动反馈：发送课程目标、题目、背景与回答，返回文本反馈。
- `shared/ai/client.ts`：统一鉴权、地址检查、超时和错误处理，不存放具体教学提示词。

OpenRouter 的结构化输出能力由具体模型/提供商决定。默认 prompt 模式不发送 response_format；启用 json_object 后会请求支持所需参数的提供商。无论哪种模式，课程都必须通过本地 schema 校验。

## 错误与限制

- 401：检查密钥。
- 402：检查账户状态和模型使用条件。
- 403：检查模型/账户权限与相关设置。
- 429：免费额度或限流，稍后重试或手动更换可用模型。
- 模型不可用、返回残缺内容或 JSON 不符合要求：会明确报错，不会偷偷返回 mock，也不会自动换成付费模型。

免费模型目录、使用限制和模型能力可能变化；项目中的路由检查不是对账户套餐或第三方未来定价的保证。当前未配置真实密钥/模型时，不会宣称已完成实际 OpenRouter 调用。

## 官方参考

- [Quickstart](https://openrouter.ai/docs/quickstart)
- [Free model variants](https://openrouter.ai/docs/guides/routing/model-variants/free)
- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
