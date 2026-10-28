# 管理员功能

## 范围与入口

- `/admin`：真实用户角色、教学课程、可学习课程、下架课程的数量汇总。
- `/admin/users`：按姓名/邮箱搜索、按角色筛选、分页，查看账号与邮箱验证状态，确认后修改角色。
- `/admin/courses`：按标题/学科/教师搜索、按上下架状态筛选、分页，查看课程简介、目标、章节标题，填写原因后下架。
- 页面、布局和 Server Actions 均检查服务器会话。学生与教师不能使用管理员服务；仓储会再次查询数据库中的管理员身份。

界面为英文，复用公共 AppShell、PageHeading、StatCard、Button、Input、Dialog、Table 和 Lucide 图标。局部布局放 `platform/admin/admin.module.css`，沿用 `--ui-*` 主题变量，不新增组件库或全局主题。

## 数据库

新增迁移 `202610270001_administration.sql`，由负责人执行 `bash scripts/local.sh db:migrate`。不得修改旧迁移。

下架状态直接存放在 `courses` 的 `moderation_status / moderation_reason / moderated_by / moderated_at` 列，代替设计稿中的独立 moderation 表。这样下架和课程加入/提交能锁定同一课程行，重新发布不会覆盖管理状态。管理操作写入 `admin_audit_events`，不保存账号密码、会话令牌或连接串。

## 角色调整

1. 校验 `userId / expectedRole / role`，拒绝客户端注入 actor 等额外字段。
2. 在事务中串行处理角色变更，重新核对管理员身份和目标角色，防止两位管理员被同时移除。
3. 最后一个管理员不可被降级。持有教学课程的教师、持有个人课程的学生，不能直接改为不兼容的角色。已有 `classrooms` 表时也检查教师的班级所有权；需要先由相应领域明确处理所有权。
4. 修改用户角色、撤销该用户全部 Better Auth 会话、写入审计，在同一事务内完成。审计失败会回滚角色和会话操作。
5. 不修改账号密码，不自动转移或删除用户资源。修改自己的角色后跳转登录页。

## 课程下架

- 默认只列出 `visibility=cohort` 的教学课程元数据；不返回课程正文、测验答案或学生个人课程。
- 下架操作幂等：重复请求返回第一次下架的记录，不覆盖原因或重复写审计。
- 从学生课程目录及可规划课程中移除，直接访问旧详情链接不可学习；加入、开放回答、测验及其 SQL 写入均检查管理状态。
- 加入/提交在 SQL 中对课程加共享行锁；下架对同一课程加排他行锁，避免跨请求绕过状态校验。
- 作者仍可查看、编辑课程。发布新版本不会恢复学习访问。
- 旧版本、加入记录、回答、教师反馈与学习路径均保留。历史路径中不可用的课程显示不可用，不据此授予访问权。
- 当前提供下架，不提供删除课程或恢复上架操作。

学习路径客户端只接收课程摘要，不传完整章节和测验答案。

## 协作入口

- 合同：`shared/contracts/features/administration.ts`，五项 administration 操作标为 implemented；个人资料操作仍为 reserved。
- Neon 仓储：`shared/database/administration-repository.ts`；只在 `APP_MODE=neon` 中提供管理员工具。
- 服务：`platform/server/administration-service.ts`；从 `@/modules/platform` 的 `platformExtensions.administration` 调用。
- 客户端调用 Server Actions：`@/modules/platform/actions`。不要在客户端导入包含服务器服务的根 barrel。
- 未来接入材料、指定版本学习、班级分配等接口时，也必须检查课程管理状态。

## 验证

`tests/administration.test.ts` 使用独立嵌入式 PostgreSQL 与 Better Auth 验证权限、严格输入、敏感字段隔离、分页筛选、旧会话撤销、最后管理员保护、角色并发前置条件、课程/班级所有权保护、审计失败回滚及下架的完整访问限制。测试不连接共享 Neon，也不修改真实成员的角色或真实课程状态。

修改后运行 `bash scripts/local.sh check`。人工验收应包含管理员总览、两类列表/搜索、详情与确认弹窗、窄屏横向表格滚动，以及学生/教师访问管理网址被阻止。真实管理操作应由负责人选择明确的测试账号/课程进行，避免拿同学的常用账号或正式课程做试验。

## 班级功能交接（2026-10-28）

管理员班级页面、统计和操作已随重复班级实现撤回，等待协作者实现接入后再适配。用户管理、角色调整、教学课程管理与下架保持可用。班级相关迁移及历史数据保留，已有班级的教师所有权保护仍有效。详见 [班级交接说明](classrooms.md)。
