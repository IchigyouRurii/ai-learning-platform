# 教师教学管理（Teaching Management）

状态：**已实现**（2026-11-05）。教师端 `Teaching Management` 从"所有课程 × 所有学生"的长卡片页，改为"筛选列表 + 学生详情"结构。

## 路由

| 路由                                              | 内容                                    |
| ------------------------------------------------- | --------------------------------------- |
| `/teacher/students`                               | 学生列表（默认）或 Private notes 收件箱 |
| `/teacher/students?view=notes`                    | 按课程/状态筛选的课程级私密笔记         |
| `/teacher/students/[studentId]?course=<courseId>` | 学生详情，按课程 Tab 展示               |

兼容参数：`?courseId=<id>`（旧班级页链接）会打开 Private notes 视图并筛选该课程；旧的 `#private-notes` 锚点保留。

## 学生列表

- 筛选维度：Course（多选）、Class（多选，按课程分组）、Student name（包含匹配，不区分大小写）；
- 维度之间是 AND，同一维度内是 OR；全部可选，可单选也可多选；
- 筛选交互：Course/Class 为悬停展开的下拉，鼠标离开整个筛选栏自动收起；Student name 为自定义 combobox，聚焦或输入期间显示按当前课程/班级过滤后的学生候选，可键盘选择或点击填入；
- 数据来源：`getWorkspace(teacher)` 的 active enrollments、submissions、teacher feedback、members，加上班级 `listMine + listMembers` 和批注 `openCounts`；
- 每个学生一行，显示课程/班级标签、进度、最近活动、已发反馈数、未处理私密笔记数；
- 进度百分比使用 Advanced quiz 的 `passedQuizzes / totalQuizzes`，与 Class 页一致；Beginner/Expert 不计入；
- 按姓名排序，每页 25 人；分页保留筛选参数，支持上一页/下一页和页码跳转；
- 班级筛选只匹配"该班级绑定的课程"下的学生，不会把学生的其他课程带进来。

## 学生详情

- 服务端校验：该学生至少有一门当前教师的 active enrollment，否则 404；
- 课程 Tab 只包含该学生与当前教师共同课程；URL 的 `course` 记住当前 Tab；
- Course progress 同样使用 Advanced quiz 的通过数/总数，显示为 `X / Y Advanced quizzes passed`；提交记录仍保留全部难度；
- 每个课程下展示：
  - 当前发布版本的提交与 AI 反馈、测验分数（如有）；
  - 已发送反馈历史和发送表单；
  - 该课程下的 Private notes，可直接回复或 Resolve；
  - 课程 Q&A 入口。
- `return` 参数保存列表的筛选和页码，返回时恢复原来的列表位置；只接受 `/teacher/students` 开头的内部链接。

## 数据与权限

- 列表和详情只读取教师自己课程的数据；未加入课程的学生不会出现在列表中；
- 私密笔记数量使用 `annotations.openCounts`，按 `courseId + studentId` 聚合 `status = 'open'`，SQL 再次校验 `courses.owner_id`；
- 发送反馈、回复/解决笔记后 revalidate `/teacher/students` 的 layout 段，列表、收件箱和详情页都会刷新；
- 班级相关代码复用现有 `classrooms.listMine` / `listMembers`，没有修改班级合同。

## 验证

- `tests/teaching-filters.test.ts` 覆盖筛选、分组、分页、分页窗口、返回链接校验和学生候选过滤；
- `tests/annotations.test.ts` 覆盖教师未处理数量聚合、按课程过滤和其他教师不可见；
- `tests/extension-services.test.ts` 覆盖新增 `annotations.openCounts` 的角色与输入校验；
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 均通过。
