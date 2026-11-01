# 课程难度

一门课程共用标题、科目、简介和学习目标，章节通过 `lessons[].difficulty` 区分 `beginner`、`advanced`、`expert`。每档最多 12 章。科目统一为 Computer Science、Mathematics、English、Business、Science、Other；历史标签在界面归类，不批量改写数据库。

- 创建：一次操作按三次独立请求生成三档，服务端强制指定难度并为章节、内容块、活动及题目编号加前缀。保留已完成结果，可单独补生成或重新生成当前难度。保存仍使用现有作者权限与课程草稿入口。
- 编辑：三档独立编辑，统一保存草稿并发布为一个不可变课程版本。未生成档可以单独生成。My Creation 与 Marketplace 的三档入口使用 `?level=beginner|advanced|expert`；未指定时默认 Beginner。学生详情也按难度显示材料和该档进度。
- 历史数据：未标记难度的旧发布快照，在三个阅读入口展示相同材料，保留原章节/活动编号。旧材料可在三档预览，但学习记录从难度迁移起按 difficulty 隔离。打开作者编辑时复制为三套独立草稿，Beginner 保留原编号，另外两档增加前缀；保存并发布后，新版本三档材料分别维护。旧发布快照和学习记录不变。
- 缺失材料：只有历史未标记数据使用兼容复制；新课程缺失某档时显示待生成，不以另一档冒充。
- 存储：沿用 `courses.draft_content` 和 `course_revisions.content` JSONB；无需 SQL 迁移，不修改已发布快照。公开投影继续移除答案及解析。现有发布、下架、所有权及加入权限不变。

OpenRouter 继续使用根 `.env` 与免费模型约束。本次系统测试使用显式 mock 或模拟模型响应，未发起真实 AI 请求，也未修改云端数据。

创建与编辑复用 `CourseDetailsFields`：Subject → Course topic → Course introduction → Learning goals。简介上限 80 字符，输入框显示计数；服务端对新建及更改后的简介执行同样校验。历史长简介不截断，未修改时可继续保存其他编辑。课程卡片由 CSS 限制最多两行，超出省略；两行显示由布局控制，字符上限不能保证所有屏幕恰好容纳完整简介。Teaching materials 仍是创建时的可选 AI 输入，不作为编辑页新增的课程字段。

上限依据：1280px 桌面视口扣除 64px 导航、56px 内容边距、两处 20px 网格间距后，三列卡片各约 373px；再扣除左右内边距 40px 与边框，正文约 331px。较窄双列布局正文约 320px，字号 14px。按普通英文单词换行留余量，将上限定为 80 字符。变宽字形和更窄屏幕仍由两行省略兜底，不承诺任意字符组合都可完整显示。

本机使用实际回退字体 SF 系统字体的 14px 字形宽度测量（非浏览器验证）：320px 正文宽度下，79 字符的 heraldry 简介为两行，而一条 91 字符的软件工程简介换行后达到三行。因此采用 80 字符作为常见英文的保守上限，不能只用字符数乘平均宽度估计。

学科新增 Literature。历史 AI-Assisted Programming / Human Computer Interaction 归 Computer Science，Classical Chinese Literature / Literature 归 Literature。按用户指定，旧 History 标签且标题为 Introduction to Medieval Heraldry 的课程归 Literature，不将其他历史课程一律归文学。标签、筛选、学生卡片、详情和编辑字段使用同一映射；不改写旧发布快照或切换学习版本。作者打开编辑时使用规范学科，保存后写入草稿。

## 当前学习难度（2026-11-01）

`enrollments.difficulty` 保存每位学生每门课唯一的当前难度。迁移 `202611010001_enrollment_difficulty.sql` 将旧加入、作答、完成记录标记为 Beginner，不重写旧发布快照。`submissions.difficulty` 和 `lesson_completions.difficulty` 隔离各档历史；章节完成唯一键增加 difficulty，因此旧材料共用章节编号也不会共享进度。

未加入或正在预览非当前难度时，只展示正文中部的大纲与 Enroll / Switch 按钮；当前加入难度才展示详细材料和活动。首次加入可选择任意有材料的难度；切换需要现有加入、预期当前难度、有效发布版本、可见性及材料校验。切换不清除记录。没有 query level 时默认显示当前难度，旧加入默认 Beginner。

所有写入以服务端当前加入难度为准；前端携带难度只用于拒绝旧标签页提交，不作为授权。作答和章节完成均在 SQL 中核对加入、难度和材料归属。My Learning 的 In progress、完成课程数及继续学习链接使用当前难度；跨档历史保留。
