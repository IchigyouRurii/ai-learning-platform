# 班级模块（协作者实现已合并）

状态：2026-10-28 已把 `feat/class-management` 合入 `feat/e-module-integration`；讨论区同时保留。main 中原有的重复班级实现已在 `3d21183` 撤回。

## 当前实现

- 教师：`My Classes` → 创建班级 → 导入已注册学生 → 绑定一门已发布课程；可编辑班级、移除成员、删除班级。
- 学生：`My Classes` → 查看自己加入的班级和绑定课程 → 进入课程学习。
- 合同：`shared/contracts/features/classrooms.ts`；服务：`platform/server/extensions/classrooms.ts`；仓储：`shared/database/classroom-repository.ts`。
- 当前模型是**一个班级绑定一门课程**（`classrooms.course_id`）。`course_assignments` 表保留，但当前班级 UI 不使用多课程/多版本分配。
- 邀请码、邮件邀请、管理员班级治理页面未恢复；管理员用户/课程管理和课程下架保留。
- 教师班级完成度按**测验**统计：每章节单独计算班级完成度；某个 quiz 取最好一次成绩，≥60% 算通过；一章内所有 quiz 都通过才算该章完成；整门课所有 quiz 都通过才算学生完成。教师端不再展示活动/章节完成，章节完成只保留给学生自己做学习定位。
- 已被班级绑定的课程禁止学生自助加入，学生需要由教师加入班级；没有绑定班级的公开课程仍可通过课程广场自助选课。

## 数据库与迁移

- 使用 main 的 `202610270002_classrooms.sql` 和 `202610270003_admin_classrooms.sql` 提供的表结构：`classrooms`、`classroom_members`、`classroom_join_codes`、`classroom_join_attempts`、`course_assignments`，以及 `enrollments.direct_access`。
- 旧迁移 `202610190001_classrooms.sql` / `202610200001_classroom_course.sql` **没有重新加入仓库**：共享 Neon 已有它们的执行记录，main 的 20261027 迁移也兼容旧结构；重新加入会在已应用新迁移的库上重复建表。新库直接使用 20261027 迁移。
- 删除班级时，仓储在同一事务内先清理 `classroom_join_codes`、`course_assignments`、`classroom_members`，再删除 `classrooms`；`enrollments` 和学习记录保留。
- 学习授权仍使用 `enrollments.direct_access=true`。班级创建/导入学生会写入默认 `direct_access=true` 的 enrollment；`direct_access=false` 的历史记录不授予访问。
- `202610290002_quiz_scores.sql` 给 `submissions` 增加可空 `score` / `max_score`；只有两项都有值时计入测验统计。`202610290001_lesson_completions.sql` 保留学生个人章节完成。
- 课程下架、成员移除、删除班级后，相关学习/讨论访问应按现有 SQL 条件失效。

## 合并时处理的冲突

- `common.ts`：采用协作者的 `FeatureStatus` 泛型版本。
- `navigation.tsx`：保留 main 的 AI Studio / Learning Path，同时加入班级入口。
- `extension-services.test.ts`：合并 administration 5 项、classrooms 8 项、discussions 5 项，共 18 项 implemented。
- 文档：保留 main 的管理员/AI 说明，补充班级实现状态。
- 迁移：移除协作者的两个 legacy 迁移文件，统一使用 main 的 20261027 班级 schema。

## 验证

- `pnpm check` 通过；班级、讨论区、扩展服务和 quiz progress 测试均通过。
- `tests/classrooms.test.ts` 覆盖班级创建/删除、成员、课程绑定、越权、事务回滚和历史保留；测试使用嵌入式 PostgreSQL，不连接共享 Neon。
- 真实 Neon 验收仍需在应用分支上执行 `pnpm db:migrate` 后手工走教师建班、导入学生、学生进入班级和讨论区流程。
