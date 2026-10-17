# Neon 使用说明

## 连接方式

本项目选择 Neon 托管 PostgreSQL，认证使用项目内 Better Auth。Neon 自身也提供托管 Auth，但本项目无需开通第二套认证服务。

官方说明：[Neon 连接指南](https://neon.com/docs/get-started/connect-neon)、[Better Auth PostgreSQL](https://better-auth.com/docs/adapters/postgresql)、[Next.js 集成](https://better-auth.com/docs/integrations/next)。

1. 在 Neon 控制台创建项目，区域选离应用服务器和主要用户较近的位置。
2. 在 Connect 中选定同一分支、数据库、角色，启用 Connection pooling 并复制完整连接串。
3. 把连接串填到唯一 `.env` 的 `DATABASE_URL`。保留控制台提供的 SSL 参数；应用不关闭证书验证。
4. 保留本机生成的 `BETTER_AUTH_SECRET`，`BETTER_AUTH_URL` 与实际访问地址对应。
5. 运行 `bash scripts/local.sh db:check`，再运行 `bash scripts/local.sh db:migrate`。
6. 启动并注册自己的账号。负责人用 `db:promote-teacher 邮箱` 设置教师；`db:seed 邮箱` 添加可选示例课程。

不要在聊天、Issue、终端截图或 Git 仓库分享含密码的连接串。脚本不会打印连接串。

## 数据库与认证

- Better Auth 管理 `user`、`session`、`account`、`verification`、`rateLimit` 表，密码由认证组件哈希保存。
- 业务表为课程、不可变发布版本、成员、提交、教师反馈、学习资料和生成任务预留。
- 所有查询只在服务器执行；浏览器不接触数据库连接串。
- 学生默认权限由服务端强制。修改角色需要可信管理命令，更新角色会撤销已有会话。
- 每个服务检查用户身份和课程关系；写入 SQL 再次约束所有权、版本或加入关系。
- 教师端显示真实课程成员姓名，不再使用演示用户硬编码。

当前 email/password 注册不校验邮箱所有权；正式使用前应接入验证邮件和密码重置。未配置的能力没有在界面上提供虚假的按钮。

## 初始化与迁移

`db:migrate` 先使用已锁定版本的 Better Auth 生成认证表，再按顺序执行 `database/migrations/` 中的业务 SQL。使用事务、迁移校验和与迁移锁；重复运行会跳过已应用文件。新变更新增迁移，不覆盖历史文件。

旧框架中未执行的其他供应商 SQL 已归档到 `database/archive/`，不参与迁移。不要在同一 Neon 项目中运行归档 SQL。

建议先用独立开发分支验收迁移，再操作需要保留的数据。应用默认连接池最多 5 个连接。Next.js 的页面和 API 使用 Node.js runtime，不需要 Edge runtime。

## 组内协作

开发者可以共用一个专用于开发的分支；需要独立测试时再创建 Neon 分支，连接对应的 DATABASE_URL。不要把生产用户数据直接复制到不受控的开发环境。

部署时在托管平台的服务端环境变量填写相同配置，`BETTER_AUTH_URL` 改成正式 HTTPS 域名。不要将云端数据库作为本地单元测试的目标。

## 常见问题

- 登录按钮不可用：检查 `.env` 是否有 DATABASE_URL、至少 32 字符的认证密钥和 URL，修改后重启。
- 数据库能连接但不能注册：先运行 `db:migrate` 创建认证表。
- 注册后进入学生端：这是默认权限；设置教师后重新登录。
- 课程列表为空：数据库是新建的，不会自动复制 demo 数据。教师可以创建课程，或运行可选 seed。
- 端口变化或登录来源被拒绝：更新 BETTER_AUTH_URL，或关闭占用端口的进程；本地 localhost 和 127.0.0.1 必须使用相同端口。
- 密码不记得：当前尚未配置邮件重置流程，不提供假重置入口；后续按 Better Auth 的邮件流程接入。
