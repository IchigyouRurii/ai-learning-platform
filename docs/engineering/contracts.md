# 模块接口与数据约定

唯一共享类型来源：`src/shared/contracts/`。使用 Zod 校验表单和 AI 输出，不在两端分别复制类型。

## 核心对象

- `CourseDraft`: 主题、目标学习者、目标、章节；章节包含内容块。
- `Course`: 草稿内容加 ID、ownerId、draft/published、visibility、version 和时间。
- `ContentBlock`: text/image/video/slides/activity；目前 UI 实现 text 与 reflection 活动，其余待接入。
- `Activity`: 类型、任务说明与评价标准。未来 quiz 需要扩充选项与判题数据；roleplay 需要对话记录协议。
- `Enrollment`: 课程与学生关系。
- `Workspace.members`: 课程相关成员的 ID、姓名与角色，不包含密码或认证表的其他信息。
- `Submission`: 课程 ID、课程版本、活动 ID、学生、回答、AI 反馈与时间。
- `TeacherFeedback`: 教师针对课程成员的反馈。

## 公共服务

从 `@/modules/platform` 调用，参数 actor 必须在服务端由 `getCurrentUser()` 取得。

| 方法                                                   | 调用方 | 规则                                           |
| ------------------------------------------------------ | ------ | ---------------------------------------------- |
| `getWorkspace(actor)`                                  | 两端   | 教师仅看自己课程；学生仅看公开课程与自己的记录 |
| `createCourse(actor, draft)`                           | 教师   | 仅教师，服务端分配 ID 和 owner                 |
| `publishCourse(actor, id)`                             | 教师   | 仅课程所有者                                   |
| `enrollCourse(actor, id)`                              | 学生   | 仅已发布、可加入课程；重复加入幂等             |
| `getLearningContext(actor, courseId, activityId)`      | 学生   | 检查加入关系与活动归属                         |
| `recordSubmission(actor, input)`                       | 学生   | 再次校验版本与归属后落库                       |
| `addTeacherFeedback(actor, courseId, studentId, text)` | 教师   | 仅自己课程的成员                               |
| `calculateProgress(course, submissions, studentId)`    | 两端   | 按当前版本的独立活动计数，不按提交次数计数     |

Server Action 返回 `ActionResult<T>`；不把用户身份、课程所有者或 AI 评价结果的可信值交给浏览器指定。

当前保存动作只创建新草稿。后续更新已有草稿、发布新版本时应新增明确的服务，不能直接操作仓储。

## Neon 适配

公共服务接口保持稳定。存储使用 PlatformRepository 的明确方法（查课程、保存草稿、发布、加入、提交、反馈），不再让真实数据库实现 read/mutate 整个状态。Repository 的 read/mutate 只用于显式 demo 模式的本地 JSON。

认证 API 位于 /api/auth/*。getCurrentUser 在服务端验证数据库会话，无会话跳转 /login；getSessionUser 供公开登录页返回可空用户。角色变更使用可信本地命令，并撤销已有会话。

## 2026-10-17 完整需求扩展

原有服务继续有效。新增领域合同位于 `shared/contracts/features/`，服务端通过 `platformExtensions` 的领域对象调用。讨论区已启用真实仓储与服务；其余新增操作仍为 reserved，返回带 `code` 的 `FeatureResult<T>`，不会访问真实外部服务。详见 [完整功能接口](feature-contracts.md) 与 [师生问答实现](discussions.md)。

作者数据与学生数据已明确分开：AuthoringDraft 包含评价配置；LearnerCourse/LearnerActivity 只含学习端可见内容。班级分配、路径、进度和答题记录绑定发布版本，草稿更新使用单独的 draftRevision。

领域仓储端口见 `shared/database/extension-repositories.ts`，真实表结构开发规划见 `database/design/README.md`。这些端口尚未接入 Neon，不能把预留字段或声明当作已实现功能。
