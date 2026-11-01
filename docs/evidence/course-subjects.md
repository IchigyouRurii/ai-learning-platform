# 现有课程学科归类

2026-11-01：新增 Literature 学科。苏东坡词作、Faust 的历史文学标签统一归 Literature；按用户截图指定，Introduction to Medieval Heraldry 也归 Literature。人机交互、AI-Assisted Programming 归 Computer Science；二叉树原学科保持 Computer Science。

实现为历史标签兼容映射：课程卡片、学科筛选、学生卡片、详情和创建/编辑下拉选项统一。仅对指定 Heraldry 课程重分类，不将其他 History 课程自动归 Literature。作者编辑时初始化规范学科，保存后写入草稿。没有批量改写云端草稿或发布快照，没有发布新版本，没有影响学习进度。

已只读核对 Neon 中现有七门课程的学科。Lint、类型检查、29 个文件/162 项系统测试及默认 Turbopack 生产构建通过。未进行浏览器验证。
