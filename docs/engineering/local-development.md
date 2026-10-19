# 本地配置与开发说明

五人协作的 AI 微课程平台。**Next.js + TypeScript + Neon PostgreSQL + Better Auth**，按教师端、学生端、平台基建组织代码。

Neon 保存用户、会话、课程和学习记录；Better Auth 处理账号密码和登录 Cookie。本项目采用应用内 Better Auth，不需要额外开通 Neon 的托管 Auth 产品。AI 暂定使用 OpenRouter；选定免费模型后填写模型 ID 和密钥即可测试。

## 第一次启动

这台电脑没有全局 Node/pnpm 时使用项目脚本；它会使用系统工具或本机已有的 Codex 运行时。

```bash
bash scripts/local.sh install --frozen-lockfile
```

1. 打开 [Neon 控制台](https://console.neon.tech/)，创建一个专用于此项目的数据库项目。
2. 在 **Connect** 中选择分支、数据库和角色，复制 PostgreSQL 连接串。应用建议使用 **Connection pooling** 提供的连接串，并保留连接串中的 TLS 参数。
3. 填写根目录唯一的 `.env`：

```dotenv
APP_MODE=neon
DATABASE_URL=从 Neon Connect 复制的完整 PostgreSQL 连接串
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=已在本机自动生成的随机密钥
AI_PROVIDER=openrouter
```

`.env` 已存在，登录密钥会在本次接入时生成；保持现有随机值即可。所有配置与密钥都放在这一份文件，不需要环境模板或第二份配置。该文件由 Git 忽略，组员单独取得同一份配置。数据库连接串和登录密钥只供服务端使用，不要加 `NEXT_PUBLIC_` 前缀。

填写后运行：

```bash
bash scripts/local.sh db:check
bash scripts/local.sh db:migrate
bash scripts/local.sh dev
```

打开 [http://localhost:3000](http://localhost:3000)，创建账号并登录。本地同端口的 `127.0.0.1` 也被允许；如启动端口变化，请相应修改 `BETTER_AUTH_URL` 并重启。

未填写连接串时，登录页面会显示尚未完成配置；不会自动冒充已登录用户，也不会自动使用本地 JSON 代替 Neon。

### 测试账号登录

登录页支持输入 `teacher`、`student`、`admin`，分别对应开发库中预置的同名 `@example.com` 账号，也支持完整邮箱。密码由负责人本地设置。短账号名只用于定位账号，仍通过 Better Auth 校验密码和读取服务端角色；不会根据输入的名称直接授予权限。普通注册继续使用邮箱，密码至少 10 个字符。

## 设置教师与示范课程

新注册账号一律是**学生**。教师身份由有权运行项目管理命令的负责人分配，注册页面不能自选教师或管理员。

先在网页注册教师要使用的邮箱，再在另一个终端执行：

```bash
bash scripts/local.sh db:promote-teacher teacher@example.com
bash scripts/local.sh db:seed teacher@example.com
```

将示例邮箱替换为实际注册邮箱。第一条会设为教师并使其旧会话失效，需重新登录；第二条给该教师添加三门短示例课程，可重复执行而不重复添加。示例用于开发联调，仍需团队完善教学内容。

真实登录模式下，学生与教师分别使用各自账号，没有任意身份切换按钮。教师创建草稿、审核发布；学生加入、提交活动；教师查看参与记录并反馈。

## 完整需求的接口框架

根据 2026-10-17 功能清单，数据契约、输入输出、领域服务入口和仓储端口已补齐。班级/分配、个人课程、编辑版本、材料上传、测验/角色扮演、章节和成绩进度、学习路径、问答、管理员及个人资料均有对应合同。

- 公共数据契约：`src/shared/contracts/features/`。
- 服务端调用：从 `@/modules/platform` 导入 `platformExtensions`，例如 `platformExtensions.classrooms.create(actor, input)`。
- 课程生成公共业务：`src/modules/course-generation/`；教师旧路径保留兼容导出。
- 存储及外部依赖端口：`src/shared/database/extension-repositories.ts`。
- 状态：`getExtensionCapabilities()` 列出预留操作。新增能力当前全部返回 `NOT_IMPLEMENTED`，不会伪造成功；现有流程保持原入口。

**接口框架齐备不等于功能已交付。** 后续按领域实现真实仓储、资源权限和页面，并新增迁移。完整输入输出、权限、职责及需求覆盖见 [功能接口](docs/engineering/feature-contracts.md)，数据关系与迁移规划见 [数据模型设计](database/design/README.md)。

## 公共 UI 组件

已接入 **shadcn/ui + Tailwind CSS 4**。Button、Input、Textarea、Label、Card、Dialog、Table 放在 `src/shared/ui/components/`，教师端和学生端共用；登录与注册页已采用基础组件。

基础组件从 `@/shared/ui/components/组件名` 导入。业务页面留在各自模块，新增组件与主题改动由基建负责人协调。接入方式和新增命令见 [公共 UI 约定](docs/engineering/ui.md)。

## 开发与检查

建议团队统一使用 **Node.js 24 LTS + pnpm 11.25.0**。安装后也可以直接使用对应的 `pnpm` 命令。

```bash
bash scripts/local.sh check
bash scripts/local.sh db:check
```

检查包含 ESLint、TypeScript、测试与正式构建。集成测试使用嵌入式 PostgreSQL，不使用云数据库、不需要真实密钥，也不会写入 Neon。

| 区域   | 路径                                                                   | 责任                                     |
| ------ | ---------------------------------------------------------------------- | ---------------------------------------- |
| 教师端 | `src/modules/teacher/`、`src/app/(workspace)/teacher/`                 | 课程制作、生成、预览、参与查看与教师反馈 |
| 学生端 | `src/modules/student/`、`src/app/(workspace)/student/`                 | 学习页面、活动、AI 反馈、个人进度        |
| 基建   | `src/modules/platform/`、`src/app/(auth)/`、`database/`、`scripts/db/` | 注册登录、身份权限、数据接口与部署       |
| 共用   | `src/shared/`                                                          | UI、数据契约、模型调用与数据库适配器     |

`app` 只编排路由。两端通过 `@/modules/platform` 公共服务共享数据，不能直接相互导入。业务提示词归各自模块；`shared/ai` 只负责模型通信。

细节见 [Neon 接入](docs/engineering/neon.md)、[架构](docs/engineering/architecture.md)、[协作](docs/engineering/collaboration.md)、[接口](docs/engineering/contracts.md)。

## 接入 OpenRouter 免费模型

在根目录唯一的 `.env` 填写：

```dotenv
AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=你选择的完整模型ID（包含实际的 :free 后缀）
AI_API_KEY=你的OpenRouter密钥
AI_FREE_ONLY=true
AI_JSON_MODE=prompt
```

地址、免费路由限制和 JSON 模式已配置。你只需填写 `AI_MODEL` 和 `AI_API_KEY`，不要把模型显示名称当成 API ID。ID 从 [OpenRouter 模型页](https://openrouter.ai/models)复制；免费模型的可用性和限流以页面及账户当前规则为准。

无需数据库连接即可独立测试：

```bash
bash scripts/local.sh ai:check
```

这条命令会向所选模型发送一次简短测试请求，不创建课程、不访问 Neon，也不打印 API Key。缺少模型或密钥时会直接提示。填写后重启开发服务，课程生成和活动反馈都会使用同一个模型。

`AI_FREE_ONLY=true` 只接受显式免费路由（`:free` 或 `openrouter/free`），不提供自动换付费模型的逻辑。`AI_JSON_MODE=prompt` 避免要求所有免费模型都支持结构化输出，课程结果仍经过本地 Zod 校验。确认所选模型支持 JSON 输出后，可改为 `json_object`。只包了一层 JSON 代码块的有效课程也可以读取；残缺或不符合结构的内容会拒绝保存。

如暂时只验证页面流程，可将 `AI_PROVIDER` 改为 `mock`。通用 OpenAI-compatible 调用仍保留，但本项目当前默认配置是 OpenRouter。

详细说明见 [OpenRouter 接入](docs/engineering/openrouter.md)。

## 本地演示与待办

如确实需要离线演示，可明确设置 `APP_MODE=demo`，使用原来的本地身份和 `.local/demo.json`；这不是实际登录，不适合公开部署。本地演示数据不会自动迁移到 Neon，真实账号也不会复用演示身份。

已提供图文与活动的数据结构，目前实现文字和开放回答活动。已有课程保存后的继续编辑、版本升级、其他活动渲染、文件上传、批量导入、自学路径、管理员业务操作仍是后续任务。Neon 是数据库，图片和视频应接入独立对象存储并在数据库保存文件引用。

公开部署前见 [上线检查](docs/engineering/production-readiness.md)。当前没有配置验证邮箱、重置密码邮件或完成 Neon 云端验收。不要把未验证邮箱当成已经确认的真实身份。

## 项目管理与 presentation

GitHub Issue/PR 模板、CI 和 CODEOWNERS 占位说明在 `.github/`。填入队友的真实用户名后再启用分支保护。CI 不使用 Neon 凭据，不执行云端迁移。

需求和计划在 `docs/product/`；访谈、测试、AI 使用与个人贡献记录在 `docs/evidence/`；报告、视频和 presentation 模板在 `docs/deliverables/`。
