# 五人协作约定

## 起步分工

| 成员占位     | 主要范围                         | 主要路径                                                         |
| ------------ | -------------------------------- | ---------------------------------------------------------------- |
| A 基建       | 身份、数据、权限、部署           | `platform/`、`database/`、全局配置                               |
| B 教师流程   | 输入、预览、编辑、发布           | `teacher/course-builder/components/`、`screens/`、教师课程路由   |
| C 课程 AI    | 生成、提示词、输出检查、课程内容 | `modules/course-generation/`、`shared/ai/`，教师旧路径仅兼容导出 |
| D 学习流程   | 内容展示、活动、AI 教学反馈      | `student/learning/`、`student/activities/`、学生课程路由         |
| E 进度与互动 | 学生进度、教师查看与反馈         | `student/progress/`、`teacher/dashboard/`、两端对应路由          |

这是职责分配，不是禁止协助。UI 不是独立岗位。共用组件先定基线，再通过 PR 协调修改。

## 需要协调的文件

- `shared/contracts/`: 修改前由调用方共同确认。基建负责人统筹合并。
- `database/migrations/`: 新增带时间戳的迁移；不要覆盖已应用的迁移。
- `shared/ui/`: shadcn 基础组件放在 `components/`，主题在 `styles.css`，原有页面样式在 `legacy.css`。由基建负责人协调维护，业务成员复用；调整时检查两端，详见 [公共 UI 约定](ui.md)。
- `package.json`、锁文件、根配置与根 layout：基建负责人审查。
- `shared/ai/`: 课程 AI 负责人审查；不放具体课程/学习提示词。

把真实 GitHub 用户名填进 `.github/CODEOWNERS` 后，打开 main 的 PR 审查与 CI 要求。未填用户名时不要以为 GitHub 已自动分派审查。

## 工作流

1. Issue 写出用户场景、范围、完成标准、依赖、负责人。
2. 从最新 main 建 `feat/teacher-...`、`feat/student-...`、`feat/platform-...` 等短分支。
3. 任务尽量拆为 1–3 天可完成的成果。不要使用持续数周的个人分支。
4. 小 PR 合并；附验证步骤与截图（有界面变化时）。每个 PR 至少一名队友审查。
5. 接口先约定，用种子数据和 mock AI 开发。每个里程碑必须联调完整流程。
6. 避免直接编辑他人正在修改的共用文件；在 Issue 留下变更方案。

## 演示与课程内容

每人有应用开发贡献，也认领课程审核、用户访谈、测试、报告或展示任务。指定一名 presentation 统筹，但每人写自己的证据与讲述材料。使用 `docs/evidence/` 和 `docs/deliverables/` 的模板。不要把最后一周全部留给做 slides。

## 完整需求的代码分工

| 领域                       | 主负责     | 实现入口                                                                                                          | 配合/复核                  |
| -------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 账号资料、管理员、存储接入 | A 基建     | `platform/server/extensions/administration.ts`、`materials.ts`                                                    | 领域人员提供调用需求       |
| 教师课程编辑、发布、预览   | B 教师流程 | `teacher/course-builder/`、`platform/server/extensions/courses.ts`                                                | C 生成接口、D 个人课程     |
| 公共课程生成与局部改写     | C 课程 AI  | `modules/course-generation/`、`platform/server/extensions/generation.ts`                                          | B/D 调用，A 复核权限与存储 |
| 学生阅读、自学、活动、路径 | D 学习流程 | `student/` 对应目录、`extensions/learning.ts`、`plans.ts`                                                         | E 进度指标、C 活动定义     |
| 班级、分配、教师跟踪与问答 | E 进度互动 | `teacher/classrooms/`、`student/classrooms/`、两端 discussions 目录、`extensions/classrooms.ts`、`discussions.ts` | D 学生入口、B 教师入口；班级名单已实现，分配/跟踪/问答待实现 |

业务目录按需创建，不为“预留”添加空页面。以上 extensions 路径均位于 `src/modules/platform/server/`；某领域负责人实现自己的文件，公共服务索引由 A 协调。每个领域可认领对应 Neon adapter 新文件；A 负责迁移、公共端口和权限策略审查，无需独自实现所有领域 SQL。

- contracts/features 下的领域文件由对应负责人维护，调用方确认变更；common.ts、聚合导出、extension-repositories.ts 由 A 协调，避免多人同时编辑。
- B/D 共用的 courses.ts 和 C/D 共用的活动结构，先确定一位接口负责人；页面开发者只调用合同，不各自复制类型。
- 新方法先对照 [完整功能接口](feature-contracts.md)，保留 NOT_IMPLEMENTED 直到真实实现、权限测试与依赖均完成。
- 每个接口实现 PR 同时交付迁移（如需要）、存储/服务、适配入口、失败状态处理、权限与版本测试；代码路径分开后仍要进行端到端联调。
- Presentation 统筹建议由 E 协调排期，五人分别维护自身功能、接口决策、测试与用户反馈的证据；展示统筹不是 E 独自制作全部材料。
