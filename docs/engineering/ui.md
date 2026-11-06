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
- Teacher navigation includes Course Marketplace, My Creation, Teaching Management and Class. The sidebar expands on pointer entry and collapses on exit; route changes do not close it while the pointer remains inside. Keyboard focus can also expand it. There is no pin button.
- Teaching Management uses a filterable student list (course, class, name; 25 per page) plus a per-student course-tab detail page, and a course-level Private notes tab. See [Teaching management](teaching-management.md).
- 表单按钮显式写 type；Dialog 提供标题、描述并使用既有 Radix 焦点管理。

## 协作与验证

UI 负责人协调共享主题和组件；模块成员组合使用。新增组件可运行：

```bash
bash scripts/local.sh dlx shadcn@4.21.5 add select
```

不要覆盖已定制组件；新增后审查差异、依赖和主题。提交前运行 lint、typecheck、相关测试及 build，并检查登录、教师／学生页面和窄屏。纯展示变更不添加镜像 DOM 的测试。

The marketplace reads real active, published teaching courses, with authors from the database; sample cards are no longer used in the application. My Creation lists only the authenticated teacher's courses across all subjects, without a subject tab bar; old subject URL parameters are ignored there. Search stays inline on both lists, and subject filtering remains available in the marketplace. Drafts stay private until reviewed and published. Publishing refreshes both catalogs. Public course details use a separate sanitized read-only route; author editing remains owner-only. Images still use illustrative Unsplash covers.

Workspace navigation keeps the shell visible and uses content skeletons instead of spinners. Full route prefetching starts on link hover/focus in production. Independent workspace queries and student home reads run in parallel, retaining actor-scoped SQL. First-time development compilation and remote database latency can still cause waiting.

The shared ProfileMenu closes on outside pointer clicks, focus leaving the menu, or Escape. Escape returns focus to the summary button.

All workspace roles reuse the teacher sidebar appearance: compact brand typography, consistent menu spacing, narrow hover expansion and the same selected state. Student/admin navigation labels, destinations and page headings are unchanged. Workspace caption rows and promotional footer cards are omitted from the sidebar so menu placement matches across roles; auth page styling is unaffected.

Catalog data and publication rules: [Course marketplace](course-marketplace.md).

学生和教师的 Marketplace 共用 `src/modules/platform/components/course-catalog.tsx`，共享搜索、学科筛选、封面和三档难度入口；通过当前角色生成各自的课程详情与创建路由。学生首页只查询公开目录元数据。统计卡、个人课程、学习路径入口及反馈保留在 My Learning（`/student/progress`）。两种角色的顶部搜索和创建按钮、Marketplace 导航图标一致；学生班级入口显示 My Class，路由不变。

My Learning 分成 My Created Courses（本人创建的个人课程）和 My Enrolled Courses（从目录或班级加入的其他作者课程），共用相同进度行。个人课程的自动加入记录不导致跨组重复。两组均显示当前学习难度和该档进度；Enrolled courses 统计只计算后者，Completed courses 统计两组的当前难度完成情况。
