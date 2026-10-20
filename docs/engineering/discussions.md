# 师生问答（讨论区）实现

状态：**已实现**（2026-10-19）。范围是课程内公开答疑，不包含公开广场。

## 可见范围与权限

- 学生：必须已加入课程，才能提问、查看该课程全部问题、回答任意问题。
- 教师：必须是课程所有者，才能查看该课程全部问题、回答、标记解决。
- 非课程成员：不能看到该课程的问题或回答；不存在“全站公开”。
- 标记解决：提问者本人或课程教师；其他学生可以回答，但不能替别人标记解决。
- 作者身份全部来自服务端会话；表单不接收 `studentId`、`teacherId`、`role` 或 `score`。

## 数据表

迁移：`database/migrations/202610190001_discussions.sql`。

```sql
discussion_questions (
  id text primary key,
  course_id text not null references courses(id),
  course_version integer not null,
  lesson_id text,
  student_id text not null references "user"(id),
  message text not null,
  status text not null check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
)

discussion_replies (
  id text primary key,
  question_id text not null references discussion_questions(id),
  author_id text not null references "user"(id),
  author_role text not null check (author_role in ('student', 'teacher')),
  message text not null,
  created_at timestamptz not null default now()
)
```

问题绑定发布版本；`lesson_id` 可空，非空时仓储会校验章节属于该发布版本。`author_role` 保存回复时的角色，避免角色变化后历史记录失真。

## 代码地图

| 层        | 位置                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 合同      | `src/shared/contracts/features/discussions.ts`                                                                           |
| 服务入口  | `src/modules/platform/server/extensions/discussions.ts`                                                                  |
| 仓储端口  | `src/shared/database/extension-repositories.ts`                                                                          |
| Neon 仓储 | `src/shared/database/discussion-repository.ts`                                                                           |
| 共享 UI   | `src/shared/ui/discussions/discussion-panel.tsx`                                                                         |
| 学生页面  | `src/modules/student/discussions/screens/course-discussion.tsx`                                                          |
| 学生动作  | `src/modules/student/discussions/server/actions.ts`                                                                      |
| 教师页面  | `src/modules/teacher/discussions/screens/course-discussion.tsx`                                                          |
| 教师动作  | `src/modules/teacher/discussions/server/actions.ts`                                                                      |
| 页面接入  | `src/modules/student/learning/screens/course-detail.tsx`、`src/modules/teacher/course-builder/screens/course-detail.tsx` |

## 页面行为

- 学生课程详情页：已加入课程后显示 `Course Q&A`；可以提问、回答同学、查看教师回复；自己的问题可以标记解决。
- 教师课程详情页：已发布课程显示 `Student Questions`；可以看到全部问题和回答、回复、标记解决。
- 课程未发布或学生未加入时不显示讨论区。

## 演示路径

1. 教师发布课程。
2. 学生 A 加入课程并提问。
3. 学生 B 加入同一课程，看到问题并回答。
4. 教师打开同一课程，看到 A 和 B 的问答并回复。
5. 学生 A 看到教师回复，或教师标记为解决。
6. 未加入课程的学生打开同一课程详情页，看不到讨论区。

## 验证

- `pnpm lint`、`pnpm typecheck`、`pnpm test` 通过（11 个测试文件、57 项测试）。
- `tests/discussion-repository.test.ts` 覆盖：非成员不可见、其他教师不可见、学生互相回答、作者信息、解决权限、旧版本、未知章节、分页和教师按学生过滤。
- 已在 Neon 分支 `discussions-dev` 完成迁移和浏览器手工验收（2026-10-20）：学生提问、学生互相回答、教师回复、标记解决、非课程成员不可见均正常。
- 测试步骤与截图证据见 [docs/evidence/discussions/README.md](../evidence/discussions/README.md)。
- 主库尚未执行迁移；合并和部署前由负责人对目标库执行 `db:migrate`。

## 后续

- 通知、未读状态。
- 撤回/删除问题与回复：建议软删除（记录 `deleted_at` / `deleted_by`），作者可在短时间窗口内撤回，教师可隐藏；已有回复时保留占位，避免线程断裂。
- 表态/表情回应：独立 `discussion_reactions` 表，按“用户 + 目标 + 表情”唯一，显示计数；不做匿名。
- 课程被移除成员后的历史可见性策略（当前问题可以保留在课程内，由现存课程成员可见）。
