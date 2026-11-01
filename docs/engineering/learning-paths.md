# Learning Path

学生入口：`/student/path`。首页展示本人保存的多条路径，课程按顺序以横向时间轴连接，课程较多时在路径面板内横向滚动。点击 Create Learning Path 进入左右两栏编辑：左侧填写背景、目标、首选难度及每周小时数，右侧生成后可修改名称、增删课程、调整顺序及逐门选择难度，课程说明显示该课程的 introduction。添加课程使用可搜索的下拉框，点击课程即可添加。

## 数据与权限

- 课程仅来自当前 Marketplace：已发布、公开教学课程、未下架。排除学生的私有 AI Studio 课程。
- 首选及每步难度统一为 Beginner、Advanced、Expert；旧路径未标记的难度按 Beginner 处理。
- AI 生成至少 2 门课程，通常推荐 2–3 门；Marketplace 不足 2 门时直接提示，不调用模型。编辑不设固定课程数上限，同一路径不重复包含一门课程，至少保留一门才能保存。
- 继续使用 `learning_paths.steps` JSON，增加可选 `difficulty`；无需数据库迁移。保存已有路径按 ID 更新，不新增重复路径；新路径生成新 ID。SQL 核对所有者、学生角色及当前已发布课程版本与难度；旧发布快照、学习记录保持原样。
- 课程更新后旧路径仍保留原版本标记。页面提示新版；编辑时需确认使用最新版本才能再次保存。学习入口与现有课程页一致，打开最新已发布内容。
- 单门 Enroll 与 Enroll in all courses 均在服务端验证身份和公开课程范围，逐门调用已有加入服务。班级管理的课程继续遵循班级权限。
- 一键加入不是整批事务。每门返回成功、已加入或失败，单门失败不阻止其余课程。已加入的课程保留当前难度与记录，不自动切换；需到课程详情页主动切换难度。

## 复用入口

- 界面：`src/modules/student/path/components/planner.tsx`。
- 页面数据：`src/modules/student/path/screens/path.tsx`。
- 生成/保存/批量加入动作：`src/modules/student/path/server/actions.ts`。
- AI 提示与校验：`src/modules/course-generation/{prompts,server}/path.ts`。
- 保存服务：`saveLearningPath`，从 `@/modules/platform` 导入；不能从客户端指定所有者。

`platformExtensions.learningPaths` 仍是预留合同；此页面使用上面已有路径服务，不将预留接口标为已实现。

## 验证范围

覆盖课程 ID、版本、难度、重复课程、路径所有权、批量加入部分失败及不隐式切换已有难度的系统测试。未做浏览器验证，未调用真实 AI，未写入共享 Neon 用户数据。
