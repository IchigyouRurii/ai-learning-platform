# 学生课程详情读取

`getStudentCourseContext(actor, courseId)` 是现有 PlatformRepository 的单课程读取入口，平台服务从服务端会话获得 actor 并校验学生角色及 ID。未接入或启用 reserved learning 扩展。

Neon 首次查询只读取指定的已发布、未下架教学课程或本人个人课程，同时获得 direct enrollment 与班级管理状态；陌生人的私有课程、草稿和下架课程返回 null。未加入课程只需这一条查询。已加入时另外并行读取本人、该课程、当前发布版本的提交和章节完成；SQL 重复核对加入与可见性。接口包含服务器需要的作者课程结构，不能整体传入 Client Component；测验仍通过 toSafeActivity 移除答案。

详情页不再使用全量 getWorkspace。批注和问答放入独立 Suspense 区域，正文不等待辅助区查询。问答仍逐条执行原权限检查，每批最多并行五条，保留原排序；未引入共享用户数据缓存。课程入口在用户 hover/focus 后提升完整预加载意图，生产环境有效；开发环境仍可能包含首次编译开销。

Demo 实现保留同样的单课程可见性和本人记录范围，班级状态仍按既有 demo 实现为 false。没有 SQL 迁移，不修改课程或学习记录。

当前学习难度由 enrollments.difficulty 决定。服务器详情上下文携带 activeLevel；正文只在所选难度与当前加入难度相同时渲染。记录查询增加 difficulty 条件。无难度标记的旧材料允许三档预览，但提交及完成记录以独立 difficulty 列区分，旧记录默认 Beginner。

## 退出课程

已加入且非本人创建的普通课程，在标题右上角提供 Leave Course；复用公共 Dialog 确认后仅撤销加入权限，不删除章节完成、提交或测验记录。同一发布版本、同一难度再次加入后恢复原进度。班级绑定课程和本人创建的课程不展示退出按钮，服务和 SQL 同时拒绝退出。课程发布新版本后的进度仍按原有版本规则隔离。
