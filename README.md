# OpenLearnING

AI 微课程学习与共享平台，使用 **Next.js + TypeScript** 开发，数据库使用 **Neon PostgreSQL**，登录使用 **Better Auth**，AI 使用 **OpenRouter 免费模型**。

## 1.本地运行

建议 Node.js 24、pnpm 11.25.0。没有全局运行时时，脚本会尝试使用本机 Codex 运行时。

```bash
bash scripts/local.sh install --frozen-lockfile
bash scripts/local.sh db:check
bash scripts/local.sh dev
```

访问 [localhost:3000](http://localhost:3000)。只有首次初始化或新增迁移时，才由负责人执行 `bash scripts/local.sh db:migrate`；不执行 `database/archive` 内的 SQL。

所有配置放根目录唯一的 `.env`，已有配置不要重复创建，不提交凭据，不使用 `NEXT_PUBLIC_` 暴露密钥：

```dotenv
APP_MODE=neon
DATABASE_URL=项目的Neon连接串
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=至少32字符的随机密钥
AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=所选免费模型ID
AI_API_KEY=OpenRouter密钥
AI_FREE_ONLY=true
AI_JSON_MODE=prompt
```

配置由负责人提供。缺少数据库配置时保留错误提示，不自动转演示；离线演示须显式设置 `APP_MODE=demo`，模拟 AI 须显式设置 `AI_PROVIDER=mock`。测试账号 `teacher/student/admin` 的密码向负责人获取；注册账号默认为学生。

更多账号、初始化及配置说明见 [本地开发](docs/engineering/local-development.md)、[Neon](docs/engineering/neon.md)、[OpenRouter](docs/engineering/openrouter.md)。

## 2.前端规范

平台统一使用英文界面、深靛蓝主色和浅灰蓝背景。开发新页面时，按下面的方式复用现有设计：

1. **先看规范**：[视觉规范](docs/engineering/frontend-ui-guide.md) 说明颜色、字号、间距和布局；[组件用法](docs/engineering/ui.md) 说明如何在代码中使用。
2. **复用组件**：按钮、输入框、卡片、弹窗等直接使用公共组件，不在各模块重新制作。
3. **沿用公共布局**：工作台页面已有侧栏和顶部栏，只需编写中间内容；页面无需再次导入全局样式。
4. **统一修改样式**：颜色、圆角和阴影优先使用现有变量或 Tailwind 语义类，如 `bg-primary`、`text-foreground`。修改公共主题或组件前，与 UI 负责人协调。

例如，在自己的页面中使用现有按钮和输入框：

```tsx
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";

export function CourseSearch() {
  return (
    <form action="/teacher" className="flex gap-2">
      <Input
        name="q"
        placeholder="Search courses"
        aria-label="Search courses"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
```

| 要复用或调整的内容                     | 对应位置                                                           |
| -------------------------------------- | ------------------------------------------------------------------ |
| 颜色、字号、尺寸、圆角和阴影           | `src/shared/ui/tokens.css`                                         |
| 公共页面布局与组件样式                 | `src/shared/ui/workspace.css`                                      |
| Button、Input、Card、Dialog 等基础组件 | `src/shared/ui/components/`                                        |
| 页面标题、课程卡片、进度条等组合组件   | `src/shared/ui/primitives.tsx`                                     |
| 平台 Logo                              | `src/shared/ui/brand-logo.tsx`；图标文件为 `public/brand-mark.svg` |

## 3.项目结构

页面入口放在 `app`，具体功能放在 `modules`，各模块共用的代码放在 `shared`。

```text
src/
├── app/                         # 页面网址与入口
│   ├── layout.tsx               # 全站布局、浏览器标题、全局样式入口
│   ├── (auth)/                  # 登录、注册页面及其布局
│   ├── (workspace)/             # 登录后的工作台页面
│   │   ├── teacher/             # 教师页面入口
│   │   ├── student/             # 学生页面入口
│   │   └── admin/               # 管理员页面入口
│   └── api/                     # 登录接口、健康检查等 HTTP 接口
├── modules/                     # 具体功能实现
│   ├── teacher/                 # 教师课程页面、课程制作、学生反馈
│   ├── student/                 # 学习页面、活动提交、学习进度
│   ├── course-generation/       # 共用的 AI 课程生成、提示词与结果校验
│   └── platform/                # 登录认证、角色权限、公共工作台与服务
└── shared/                      # 各功能共用的代码
    ├── ui/                      # 公共样式、组件和 Logo
    ├── contracts/               # 数据类型、输入校验和功能接口约定
    ├── database/                # 数据库连接与数据读写
    ├── ai/client.ts             # AI 服务请求与配置检查
    └── config.ts                # 运行模式与登录配置检查

public/                          # Logo 等静态资源
database/                       # 数据表迁移及数据库设计文档
scripts/                         # 本地运行、数据库管理与 AI 检查脚本
tests/                           # 自动化测试
docs/                            # 需求、开发规范、测试记录与交付文档
.env                             # 本地配置与密钥，不提交 Git
package.json                     # 项目依赖与运行命令
```

开发时，在 `app` 中连接页面，在对应 `modules` 中实现功能。模块内部的 `screens` 放页面内容，`components` 放交互组件，`server` 放服务端逻辑，`prompts` 放该功能的 AI 提示词。

教师与学生模块不互相导入；公共服务通过 `@/modules/platform` 使用，共用课程生成逻辑放在 `course-generation`。数据库和 AI 密钥只在服务端使用。

## 4.管理员工作台

管理员登录后进入 `/admin`，可查看平台汇总、在 `/admin/users` 搜索用户并调整角色、在 `/admin/courses` 查询教学课程元数据并说明原因下架，在 `/admin/classes` 查看全平台班级、成员与课程安排，并可归档/恢复班级、移除成员或撤销安排。普通注册仍默认创建学生，用户无法自行选择管理员角色。

管理员相关迁移为 `202610270001_administration.sql` 和 `202610270003_admin_classrooms.sql`（班级基础使用中间的 002 迁移）。由数据库负责人执行一次 `bash scripts/local.sh db:migrate`，其他成员共享同一个 Neon 数据库时无需重复初始化。

界面沿用现有 AppShell、shadcn/ui、Lucide 图标及公共主题。管理员代码位于 `src/modules/platform/admin/`，服务复用 `platformExtensions.administration`；其他扩展域仍按各自状态开发。操作规则与验收说明见 [管理员功能](docs/engineering/administration.md)。

## 5.班级管理

教师在 `/teacher/classes` 创建/编辑班级，生成 7 天邀请码或按已有学生邮箱导入成员，再分配已发布课程的指定版本和可选截止日期；可移除成员和撤销分配。学生在 `/student/classes` 加入班级并学习分配版本。

需要新增迁移 `202610270002_classrooms.sql`，由负责人执行 `bash scripts/local.sh db:migrate`。班级授予的访问与原有独立选课分开；移除成员保留学习记录，不影响其他合法选课。截止日期仅作提醒，暂不发送邀请邮件。详见 [班级管理](docs/engineering/classrooms.md)。

管理员归档班级会暂停班级授予的访问并撤销邀请码，保留成员/课程安排和学习历史；恢复后教师需生成新码，课程下架状态继续有效。操作需填写原因并记审计。
