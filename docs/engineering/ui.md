# 公共 UI 与 shadcn/ui

项目使用 React、Tailwind CSS 4 和 shadcn/ui，组件源文件随仓库管理。shadcn 是基础 UI，不提供课程、权限或数据库逻辑。

## 目录

- `components.json`：官方 CLI 配置，采用 `new-york` 风格和 Lucide 图标。
- `src/shared/ui/components/`：基础组件。目前包含 Button、Input、Textarea、Label、Card、Dialog、Table。
- `src/shared/ui/utils.ts`：统一的 `cn` 类名合并工具，使用当前官方组件依赖的 `cn` 包。
- `src/shared/ui/styles.css`：Tailwind 入口、语义颜色与圆角变量，主题沿用平台的绿色。
- `src/shared/ui/legacy.css`：原有页面样式，放在 CSS components 层。原有表单元素规则排除带 `data-slot` 的基础组件，避免相互覆盖。
- `src/shared/ui/primitives.tsx`：课程卡片、进度展示等现有公共组合组件，按需逐步迁移。

登录和注册页已使用 Button、Input、Label，登录校验与服务端权限保持原有流程。当前只提供浅色主题；配置中的 dark 变体用于兼容官方组件，不代表已经实现主题切换。

## 使用

```tsx
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

export function CourseTitleField() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="course-title">课程标题</Label>
      <Input id="course-title" name="title" placeholder="输入课程标题" />
      <Button type="submit">保存</Button>
    </div>
  );
}
```

Dialog 请同时提供 DialogTitle、DialogDescription，并检查键盘聚焦与关闭行为。表单仍需关联标签；Button 在表单内显式指定 `type`。

## 新增与协作

在项目根目录运行，例如新增下拉选择框：

```bash
bash scripts/local.sh dlx shadcn@4.21.5 add select
```

本次使用官方 CLI 4.21.5 和官方默认 registry。后续升级 CLI 由基建负责人统一处理。新增后检查组件导入、直接依赖与样式；当前 registry 的 Button 使用 `class-variance-authority`，已显式安装。

基础组件和主题由基建负责人协调维护，成员在各自业务目录中组合使用。课程、班级、进度等业务 UI 留在各自模块；不要把业务服务、角色判断或密钥放进基础组件。不要对已定制的组件直接运行 `--overwrite`，先审查差异。

新增或调整组件后运行 lint、typecheck；涉及共享主题或依赖时运行生产构建，并检查登录页及两端页面的桌面和窄屏布局。组件交互验证使用实际浏览器，无需为静态标记添加重复测试。

## 本次验证（2026-10-17）

- 官方 CLI 4.21.5 已生成七种基础组件，组件依赖与 pnpm 锁文件已更新。
- ESLint、TypeScript、认证集成测试 12 项通过。测试使用嵌入式 PostgreSQL。
- 在隔离的源代码副本中执行 Next.js 生产构建（Webpack）通过；副本没有复制 `.env`，未改动正在运行的本地开发服务。
- 本地开发网页实际使用 `teacher` 账号登录，进入教师工作空间并正常退出。
- 桌面登录与注册页检查通过；390px 窄屏注册页文档宽度为 390px，表单宽度 340px，无横向溢出。
- 浏览器未记录 error/warn。未新增真实注册用户，未调用 AI，也未更改数据库结构。
- 尚未把其他业务页面逐一迁移到新组件；Dialog、Table 等组件已安装，通过类型检查，但未接入业务流程。
