# Neon 接入验证记录

日期：2026-10-17。最终项目路径：`/Users/luojing/Documents/CodeProjects/ai-learning-platform`。

## 已验证

- `bash scripts/local.sh check`：ESLint 无警告、路由类型生成与 TypeScript 通过、5 个测试文件共 23 项测试通过、Next.js 生产构建通过。
- PostgreSQL 集成测试使用 PGlite 的真实 PostgreSQL 引擎，验证了业务 SQL 和迁移的执行；没有连接或改动云端数据库。
- 认证测试实际执行 Better Auth 注册、正确/错误密码登录、密码哈希、会话签发、退出失效、教师角色变更后旧会话撤销、公开 API 不能提权，以及来源检查。
- 数据测试验证了草稿可见性、事务发布与独立版本、重复加入、活动/版本/加入关系校验，以及跨账号提交/反馈隔离。
- 浏览器访问 `/teacher` 在未登录时跳转 `/login`；注册入口正常；缺少 DATABASE_URL 时注册和登录明确不可用，不回退到 demo。
- 登录页面在 1280px 宽度没有横向溢出。
- `db:check` 在缺少连接串时给出明确提示，不打印连接配置。
- 根目录只有 `.env`，包含服务器配置和随机登录密钥，并由 Git 忽略。

## 仍需用户配置后验证

- DATABASE_URL 当前为空，没有连接 Neon 实例，也没有在 Neon 云端执行迁移。
- 填写后依次运行 db:check、db:migrate，再用真实账号验收；教师角色和示例课程按 README 设置。
- 尚未配置验证邮箱/重置密码邮件、实际对象存储或公开部署。

嵌入式测试通过不等于特定 Neon 项目的网络、数据库角色权限和云端迁移已经验收。
