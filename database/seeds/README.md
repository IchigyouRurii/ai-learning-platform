# 示例课程

运行 `bash scripts/local.sh db:seed 实际已注册的教师邮箱`，会把 `src/shared/database/seed.ts` 的三门短课程写入 Neon，并关联到实际教师账号。

脚本使用真实账号 ID、生成新的课程 ID，并按教师和 seed_key 去重。不会创建共享密码账号，也不会把本地 demo 的学生或提交写入真实数据库。

先运行 db:migrate 并设置教师身份。示例内容只用于开发联调，最终教学课程仍需审核完善。
