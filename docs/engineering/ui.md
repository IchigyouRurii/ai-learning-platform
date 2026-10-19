# 公共 UI 接入

统一视觉以 [前端规范 v2](frontend-ui-guide.md) 为准：深靛蓝、浅灰蓝渐变、64px 窄导航、60px 顶部栏、18px 阴影卡片。平台名称统一为 **OpenLearnING**，界面使用英文；保留角色权限和业务流程。登录页只更新品牌与文案，布局和样式保持不变。

## 样式入口

- `src/shared/ui/tokens.css`：原型提取的颜色、字体、尺寸、圆角与阴影；辅助文字适当加深。
- `styles.css`：全局入口，将变量映射到 Tailwind CSS 4 / shadcn/ui 语义主题。
- `workspace.css`：现有业务页统一布局和组件外观；手机端保留文字导航和单列课程。
- `legacy.css`：旧页面结构兼容。`--green` 等旧变量暂时映射到新主题，新增代码勿继续使用旧命名。

根布局已加载样式，页面无需重复导入。颜色优先使用 `bg-primary`、`text-foreground` 等语义类，不独立硬编码主题。

## 组件复用

```tsx
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

export function CourseTitleField() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="course-title">Course title</Label>
      <Input id="course-title" name="title" placeholder="Enter a course title" />
      <Button type="submit">Save</Button>
    </div>
  );
}
```

- 基础组件位于 `src/shared/ui/components/`，包含 Button、Input、Textarea、Label、Card、Dialog、Table。
- 组合组件 `CourseCard`、`PageHeading`、`ProgressBar` 等从 `@/shared/ui/primitives` 导入。
- 教师／学生业务组件保留在各自模块；公共组件不能导入业务服务或凭据。
- AppShell 已由工作空间路由提供，不在业务页面重复包裹。
- 平台 Logo 统一复用 `@/shared/ui/brand-logo` 的 `BrandLogo`；SVG 位于 `public/brand-mark.svg`，白色图标搭配深蓝底。
- 教师导航为 Course Marketplace、My Creations、Teaching Management；创建课程入口放在顶部。窄侧栏支持悬停、聚焦展开和按钮固定。
- 表单按钮显式写 type；Dialog 提供标题、描述并使用既有 Radix 焦点管理。

## 协作与验证

UI 负责人协调共享主题和组件；模块成员组合使用。新增组件可运行：

```bash
bash scripts/local.sh dlx shadcn@4.21.5 add select
```

不要覆盖已定制组件；新增后审查差异、依赖和主题。提交前运行 lint、typecheck、相关测试及 build，并检查登录、教师／学生页面和窄屏。纯展示变更不添加镜像 DOM 的测试。

当前仍是功能框架，不将原型演示交互当成真实功能。课程广场使用 Figma 的 6 门展示课程，明确标注 Prototype preview；学科筛选、标题／作者搜索可用。三档难度入口打开未接通说明，不伪造加入或创建成功。My Creations 展示现有真实课程并保留详情、创建、发布流程。封面沿用原型 Unsplash 地址（需要联网），Logo 为本地 SVG；字体使用系统回退。已有课程和用户内容不自动翻译，新 AI 课程与反馈默认英文。
