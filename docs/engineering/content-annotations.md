# 课件内容批注（Content annotations）

状态：**已实现**（2026-10-29）。范围是学生对课程内容块的私密疑问/批注，以及教师回复与处理状态。

## 交互与权限

- 学生可以对自己已加入课程的**内容块**写批注；
- 可选保存选中的文字 `quote`，不做精确高亮；
- 分类固定为 `Question` / `Unclear` / `Possible error` / `Outdated`；
- 批注只对**提问学生本人和课程教师**可见，不对全班公开；
- 教师只能读取自己课程中的批注；
- 教师可以回复或直接 Resolve；一条批注保留一条教师回复，学生可新建批注继续追问；
- 教师回复/解决后，学生端出现未读提醒；学生展开批注看到回复后标记已读。

## 未读规则

| 角色 | 未读定义                                        | 何时消失                 |
| ---- | ----------------------------------------------- | ------------------------ |
| 教师 | `status = 'open'`（未处理）                     | 教师 Reply 或 Resolve 后 |
| 学生 | `status <> 'open'` 且 `student_seen_at is null` | 学生展开批注看到回复后   |

教师端负责“是否处理”，学生端负责“是否已读”，两者不是同一个概念。

## 数据表

迁移：`database/migrations/202610290004_content_annotations.sql`。

```sql
content_annotations (
  id text primary key,
  course_id text not null,
  course_version integer not null,
  lesson_id text not null,
  block_id text not null,
  student_id text not null references "user"(id),
  quote text not null default '',
  category text not null check (
    category in ('question', 'unclear', 'possible_error', 'outdated')
  ),
  message text not null,
  status text not null check (status in ('open', 'replied', 'resolved')),
  teacher_reply text,
  replied_by text references "user"(id),
  replied_at timestamptz,
  student_seen_at timestamptz,
  created_at timestamptz not null default now()
)
```

`lesson_id` / `block_id` 必须属于指定发布版本；`student_seen_at` 在创建时写入，教师回复/解决时清空，学生标记已读时写入。

## 页面

- 学生课程页：每个内容块下有 `Comment` 入口；课程页底部有 `My content questions` 汇总，显示分类、引用、状态、教师回复和学生未读红点；
- 教师 Teaching Management：每个学生卡片下有 `Content questions` 区块，显示未处理数量、分类/引用/问题、回复框和 Resolve；并提供跳转到课程 Q&A 的链接，方便教师手动发布更正。

## 代码地图

| 层           | 位置                                                     |
| ------------ | -------------------------------------------------------- |
| 合同         | `src/shared/contracts/features/annotations.ts`           |
| 服务         | `src/modules/platform/server/extensions/annotations.ts`  |
| 仓储         | `src/shared/database/annotation-repository.ts`           |
| 学生 UI      | `src/modules/student/annotations/`                       |
| 教师 UI      | `src/modules/teacher/annotations/`                       |
| 学生页面接入 | `src/modules/student/learning/screens/course-detail.tsx` |
| 教师页面接入 | `src/modules/teacher/dashboard/screens/students.tsx`     |

## 验证

- `pnpm check` 通过；
- `tests/annotations.test.ts` 覆盖：学生创建/读取、非成员拒绝、其他教师不可见、未知 block 拒绝、教师回复/解决、学生已读、学生不可代读；
- 真实 Neon 验收前需执行 `pnpm db:migrate`。

## 后续

- 精确文本范围高亮；
- 多轮教师/学生回复；
- 教师按分类筛选、独立批注收件箱；
- 批注数量很大时的分页。
