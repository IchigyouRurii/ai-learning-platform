# 完整需求的协作接口

依据：2026-10-17 用户提供的功能清单截图，并沿用当前 Next.js、TypeScript、Neon、OpenRouter。本文补充接口和数据设计，不代表新增功能已经可用。

## 状态与入口

现有登录、教师建课/首次发布、学生加入、开放回答、AI 反馈和教师反馈保留原来的调用入口。已有功能的可运行代码、云端连接测试与完整业务验收分别记录，不能混为一谈。

新增接口统一从服务端 `@/modules/platform` 的 `platformExtensions` 导入。可用 `getExtensionCapabilities()` 查看新增操作的状态、角色和资源权限约定。**administration 五项、classrooms 八项、discussions 五项操作已启用**，详情见 [管理员功能](administration.md)、[班级管理](classrooms.md)、[师生问答实现](discussions.md)。其余扩展操作仍为 reserved：校验角色与输入后返回 `NOT_IMPLEMENTED`，不访问数据库、AI、邮件或对象存储，不返回空数组、假任务或模拟成功。其他模块已有的旧入口不因对应扩展仍预留而被认定为未实现。

```ts
import { getCurrentUser, platformExtensions } from "@/modules/platform";

// 在 Server Action 或 Route Handler 内；不要从请求中接收 actor。
const actor = await getCurrentUser();
const result = await platformExtensions.classrooms.create(actor, {
  name: "软件工程一班",
});
// 班级实现已合并；合法调用会访问真实 Neon 仓储。
```

这些是模块服务接口，不是已经发布的 HTTP API。后续按页面需要增加薄的 Server Action；外部调用和回调需要 Route Handler。两种适配都应复用同一服务层。

## 三层合同

| 层        | 文件                                            | 约定                                                                                                            |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 输入/输出 | `src/shared/contracts/features/*.ts`            | Zod schema、可推导 TS 类型、角色、资源规则、预留状态                                                            |
| 业务入口  | `src/modules/platform/server/extensions/*.ts`   | 每个领域独立文件；administration、classrooms 与 discussions 按操作状态启用，其他预留操作逐项实现 |
| 存储端口  | `src/shared/database/extension-repositories.ts` | 具名且 actor-scoped 的查询与写入；未来 Neon adapter 必须实现所有权及版本条件                                    |

现有 `PlatformRepository` 不被扩展成一大组假方法。新端口与其并存，逐个领域接入真实 adapter 后启用，避免为了添加类型而破坏现有数据库适配器。

### 结果格式

新增服务返回 `FeatureResult<T>`：成功为 `{ ok: true, data }`，失败为 `{ ok: false, code, error }`。`error` 为适合显示的文字；不含原始 SQL、连接串、上游响应或内部堆栈。该格式保留现有 `ActionResult` 的 string error 兼容性，新增失败必须有 code。

| code                   | 含义                                    |
| ---------------------- | --------------------------------------- |
| AUTH_REQUIRED          | 未登录                                  |
| FORBIDDEN              | 角色或资源权限不足                      |
| INVALID_INPUT          | 请求不合法                              |
| NOT_FOUND              | 不存在或不应透露的资源                  |
| CONFLICT               | 草稿版本、角色前置条件、幂等参数等冲突  |
| RATE_LIMITED           | 限流或额度限制                          |
| DEPENDENCY_UNAVAILABLE | 存储、邮件、AI、worker 等必要依赖不可用 |
| NOT_IMPLEMENTED        | 仅有合同，功能未实现                    |
| INTERNAL_ERROR         | 未预期内部错误，日志脱敏                |

新服务可使用公开导出的 `FeatureServiceError` 表达安全的领域失败，并通过 `featureFailure` 转为结果；未识别的内部错误只返回通用提示，Next.js 重定向/404 控制流会继续抛出。不得用原始 SQL 或模型错误直接构造用户消息。

预留入口只做会话 actor 是否存在、角色白名单、输入校验。`resourcePolicy` 是待实现且必须测试的规则，字符串本身不执行授权。入口接入真实逻辑前，必须完成资源查询、服务端授权与 SQL 条件校验，不能简单删掉 NOT_IMPLEMENTED。讨论区已按此要求接入真实仓储，权限条件写在参数化 SQL 中。

## 按领域的完整操作

具体参数与返回类型以对应 schema 为唯一来源；下列名称对应真实存在的 TS 方法。

### 1. 账号、管理员

合同：`features/administration.ts`；入口：`extensions/administration.ts`。

- `accountProfiles.getMine / updateMine`：读取自己的基本资料、修改称呼。普通用户不能从资料接口修改角色。
- `administration.getOverview / listUsers / changeRole`：管理员查看平台汇总、查询用户，按 expectedRole 修改角色。
- `administration.listCourses / withdrawCourse`：管理员查询教学课程元数据、说明原因并下架课程。

角色修改须在同一事务内核对旧角色、保护最后一个管理员、撤销会话、写审计。教师仍持有课程/班级时，不兼容的角色修改返回 CONFLICT，直到明确处理所有权；学生的个人课程也保留相应所有权保护。下架不删除记录，同时覆盖旧的目录、加入、学习读取和提交接口。管理员接口不是教师课程编辑入口，不默认开放个人自学正文。

邮箱验证/密码重置仍需邮件服务，不能因有账号合同就宣称具备验证邮件。

### 2. 班级、成员、课程分配

合同：`features/classrooms.ts`；入口：`extensions/classrooms.ts`。

- `create / listMine / listMembers`：建班、班级列表、教师看名单。
- `inviteStudents / acceptInvitation`：按邮箱邀请、受邀学生接受邀请。
- `importStudents`：把已注册学生账号批量加入班级，返回缺失邮箱；不创建密码或冒充已验证邮箱。
- `createJoinCode / joinByCode`：教师取得短期班级邀请码，学生加入。
- `removeMember`：移除班级成员并保留历史。
- `assignCourse / listAssignments`：预留指定发布版本分配与安排读取。

`Classroom` → `ClassroomMember` → `CourseAssignment` 为明确的独立关系。原 `Enrollment` 仍表示课程加入，不代替班级成员。当前 visibility=cohort 的历史语义是公开教学课程，不据此推断“属于某班”。班级不自动构成私有课程库；若后续需要班级专属课程，应先扩展可见范围合同。

分配绑定发布版本。学生从安排进入课程时传该版本，不能始终加载最新版。班级名单只对班级教师开放；邀请令牌只有匹配且已验证邮箱的学生能消费。现阶段邮箱验证尚未接入，这项依赖必须先完成；邀请码与邮件邀请仍为预留，当前通过导入已注册学生加入班级。

### 3. 课程创建、编辑、发布与个人自学

合同：`features/courses.ts`；入口：`extensions/courses.ts`。

- `listCatalog / listMine`：教学目录、本人课程。
- `getEditor / updateDraft`：读取作者草稿、按 expectedDraftRevision 更新完整内容。
- `createPersonal`：学生新建自己的个人课程。
- `publishRevision`：教师发布教学快照；学生激活仅本人可学的个人快照。
- `listRevisions / getRevisionForAuthor`：作者查询历史元数据与完整配置。

教师管理自己的教学课程；学生管理自己的 personal 课程。学生生成不意味着进入全校目录，也不意味着获得教师权限。编辑版本号 draftRevision 与发布版本 version 分离；并发覆盖必须返回 CONFLICT，旧发布快照和提交永不原地修改。

`CourseEditor` 是作者专用对象，包含答案。读取给学生的正文必须使用学习视图投影，活动只能返回 `LearnerActivity`。`getRevisionForAuthor` 不能用来实现学生阅读页。

### 4. 公共课程 AI

合同：`features/generation.ts`；入口：`extensions/generation.ts`。

- `generateDraft`：主题、目标、背景、难度、文字材料、自己的 materialIds → 完整作者草稿。
- `rewritePart`：指定草稿版本以及章节/文字块/活动 → 局部替换建议；不自动覆盖或保存。
- `startCourseJob / getJob`：预留异步课程生成任务与本人任务读取。

公共业务实现目录为 `src/modules/course-generation/`。原教师侧生成与解析文件保留兼容导出，教师页面继续使用原有流程；当前复用核心仍只生成文字和开放回答。新增 generateDraft 需要实现完整材料解析、难度与活动配置后才能启用，不直接把旧核心标为完整实现。

`src/shared/ai/` 仅处理模型请求、超时和供应商错误。领域提示词放在 `modules/course-generation/prompts/`；学生反馈提示词继续在学生模块。教师、学生模块互不导入。

对象存储、材料提取、任务 worker 尚未接入；异步接口不能先写 queued 后没有任何执行者。当前后台任务合同仅针对课程生成，未来新增其他任务须使用对应的判别结果类型。

### 5. 活动、得分、角色扮演与进度

合同：`features/activities.ts`；入口：`extensions/learning.ts`。

- `getCourse / getActivity`：读取指定发布版本的安全课程正文与活动定义。
- `submitAttempt / listAttempts / listStudentAttempts`：提交回答、查看自己的历史尝试、教师查看自己班级成员的尝试。
- `completeLesson / getMyProgress`：章节完成、本人课程进度。
- `getStudentProgress / getClassProgress`：教师查看班级成员及班级汇总。
- `startRoleplay / sendRoleplayMessage / finishRoleplay`：由服务器保存对话历史、调用 AI 和结束反馈。

新 `AuthoringDraft` 在现有 CourseDraft 外附完整活动配置。开放回答兼容已有 course JSON；测验等其他类型必须有与嵌入活动 ID/类型一致的配置，不能只有一个 quiz 类型名。配置与课程发布版本一起冻结。

作者活动包含 `learner` 和私有 `evaluation`。前者定义题面、选项、场景等；后者包含答案与评价说明。`toLearnerActivity` 只输出前者。测验支持单选/多选、多题、正确选项、解释及分值。答案与分数由服务器验证计算，客户端只提交答案，不能传 studentId、score、aiFeedback。

章节完成、活动提交、测验成绩为三个独立指标。重复尝试保存历史，进度按活动去重，成绩默认取该版本该活动的最近一次有效评分，不把多次得分相加；角色扮演结束计为该活动参与完成。学习记录均带 courseVersion。评分结果须满足 0 ≤ score ≤ maxScore，未评分两者都为 null。

提交和发送对话带 idempotencyKey。实现时同一用户+同一操作+key 幂等；同 key 不同内容返回 CONFLICT。角色扮演消息的角色、对话历史和 AI 回复不能由客户端伪造。

coding、simulation、game 已有题面/回答的基础结构，执行、模拟和计分规则仍需各自实现。代码执行必须由独立沙箱服务承接，不能在 Next.js 服务器执行学生代码。

### 6. 学习档案、学习路径

合同：`features/plans.ts`；入口：`extensions/plans.ts`。

- `learningProfiles.getMine / updateMine`：背景、目标、难度、每周可用分钟数。
- `learningPaths.generate / save / listMine / getMine`：建议草稿、保存路径、本人路径列表及详情。

路径步骤明确记录 courseId、courseVersion、order、targetMinutes、reason。AI 只能推荐已授权且可学习的现有课程，不能凭空编造 ID；保存时逐个重新检查。路径本身不会授予访问权。默认一个路径不重复包含同一课程。

### 7. 材料与对象存储

合同：`features/materials.ts`；入口：`extensions/materials.ts`。

- `requestUpload / confirmUpload`：申请短期上传、服务端确认存储对象并进入提取流程。
- `listMine / getReadUrl`：读取材料元数据、申请短期读取链接。

`ObjectStoragePort` 约定签发上传、检查对象、签发读取。默认单文件上限 20 MiB 是工程初始值，不是课程要求，后续改动先协调合同。类型白名单只是允许声明的格式，不代表解析器已经支持；未配置解析/转写能力时返回依赖不可用。

上传者不能提交服务器对象键或指定任意 URL 让服务器抓取；存储路径用服务端随机键。confirmUpload 由服务端核对实际对象大小、类型，不相信浏览器宣称上传完成。私有材料与公开课程附件须分开授权。

### 8. 师生问答

合同：`features/discussions.ts`；入口：`extensions/discussions.ts`。

- `ask / listThreads / getThread`：课程提问、课程问题列表、线程。
- `reply / resolve`：课程成员回答、提问者或教师标记解决。

问题关联课程版本和可选章节。**课程内公开**：已加入课程的学生可以查看该课程全部问题与回答，学生之间可以互相回答；教师只能查看自己课程的全部问题与回答，并可以回答或标记解决；非课程成员不可见。问题与回复都返回作者 `{ id, name, role }`，不暴露账号其他信息。个人自学课程没有自动绑定教师。现有 TeacherFeedback 继续表示教师针对学习记录的建议，不代替问答线程。

## 需求覆盖矩阵

| 截图条目                             | 当前基础与新增合同                                                          |
| ------------------------------------ | --------------------------------------------------------------------------- |
| 平台 1：账号资料                     | 原注册/登录/退出 + accountProfiles                                          |
| 平台 2：角色权限                     | 原会话与角色检查 + 每项 feature 的 roles/resourcePolicy                     |
| 平台 3：导航工作台                   | 原两端工作台 + classrooms.listMine/listAssignments + learningPaths.listMine |
| 平台 4：课程浏览                     | 原课程页面 + courseManagement.listCatalog + 安全活动投影                    |
| 平台 5：管理员                       | administration 用户/课程管理接口；班级由协作者实现接入                      |
| 生成 1：主题、目标、背景、难度、材料 | generationRequestSchema + materials                                         |
| 生成 2：大纲、章节、互动测验         | AuthoringDraft + 活动配置 + generation.generateDraft                        |
| 生成 3：结构校验、网页呈现           | Zod schemas + 现有文本 renderer；其他 renderer 由学生流程实现               |
| 生成 4：手动/AI 编辑、排序           | updateDraft 完整有序章节数组 + rewritePart                                  |
| 生成 5：草稿、预览、发布             | 原入口 + getEditor/updateDraft/publishRevision                              |
| 生成 6：初始微课程                   | 已有三门 seed、db:seed；正式课程内容仍需人工审核与完善                      |
| 生成 7：个人学习路径                 | learningProfiles + learningPaths                                            |
| 互动 1：班级、学生                   | classrooms 成员、导入、邀请、加入                                           |
| 互动 2：课程分配、计划               | assignCourse/listAssignments + learningPaths                                |
| 互动 3：章节/活动/分数进度           | learning 完成、提交、成绩与进度合同                                         |
| 互动 4：AI 反馈与历史                | ActivityAttempt + listAttempts + 角色扮演会话                               |
| 互动 5：教师跟踪                     | getStudentProgress/getClassProgress                                         |
| 互动 6：师生问答与反馈               | discussions + 原 addTeacherFeedback                                         |

## 启用一个领域的完成条件

1. 负责人与调用方确认 input/output、资源权限、失败码及版本规则。
2. 先新增必要的时间戳迁移，在隔离开发库验收，不修改已应用 SQL。设计映射见 `database/design/README.md`。
3. 实现领域仓储和服务，参数化 SQL 重复检查所有权、成员关系、版本；事务处理发布、授权和角色变更。
4. AI/存储/邮件/worker 依赖确实可用，错误有明确结果；不能模拟成功。
5. 服务端验证输出 schema，接入页面适配层；页面不能把用户身份当请求参数。
6. 补权限、串改 ID、旧版本、并发/幂等测试和完整流程验收。
7. 将该项 status 改为 implemented，并由真实服务替换预留方法，同时更新能力清单与边界测试。当前 FeatureDefinition 已支持 reserved / implemented；不得仅修改标记而保留预留服务。

界面开发可用成员本地 fixture，但不能把 fixture 当真实数据库或 AI 的返回。预留入口失败只说明接口存在，不代表功能验收完成。

## 本次验证记录（2026-10-17）

- 新增 10 个服务分组，共 56 个预留操作；能力清单全部报告 reserved。
- 9 个测试文件、50 项测试通过，涵盖原有认证/Neon SQL/课程流程/模型调用，以及新增入口的角色限制、无会话失败、严格输入、答案隔离、版本与分数校验、错误脱敏和 Next 导航控制流。
- 每个预留操作均使用有效请求样例验证 NOT_IMPLEMENTED；预留调用没有访问数据库或模型。
- ESLint、TypeScript 通过。在不含 `.env` 的隔离源代码副本中完成 Next.js 生产构建（Webpack），未覆盖正在运行的开发服务产物。
- 没有执行新 Neon 迁移、创建业务数据、调用真实 AI、发送邀请邮件或上传材料。
- 本次未实现班级、个人建课、上传、测验、路径、问答或管理页面；资源级授权规则是实施要求，尚未接入真实仓储。

## 本次验证记录（2026-10-19）

- 启用讨论区：新增 `discussion_questions`、`discussion_replies` 两张表及 `202610190001_discussions.sql`。
- 讨论区改为**课程内公开**：已加入课程的学生可查看并回答该课程全部问题；教师仅可查看自己课程并回答/解决；非课程成员不可见。问题和回复返回作者姓名与角色。
- `platformExtensions.discussions` 由预留工厂替换为真实服务；仓储权限条件写在参数化 SQL 中，覆盖课程成员、课程所有者、提问者/教师解决、版本与章节校验。
- 新增 pglite 集成测试，覆盖非成员不可见、跨教师不可见、学生互相回答、解决权限、旧版本和未知章节。`pnpm lint`、`pnpm typecheck`、`pnpm test` 通过（11 个测试文件、57 项测试）。
- 已在 Neon 分支 `discussions-dev` 执行迁移并完成浏览器手工验收；主库尚未迁移，部署前须在主库执行迁移。
