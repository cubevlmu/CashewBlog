# PrimeVue 所见即所得 Markdown 编辑器设计规格

日期：2026-09-28
状态：待审阅

## 目标

替换后台文章编辑器中的 Milkdown Crepe，实现一个由 Vue 3 + PrimeVue 组装的所见即所得编辑器。编辑器必须保持当前功能等级和数据契约：正文继续以 `contentMarkdown` 保存，现有自动保存、预览、媒体库上传、草稿/发布工作副本语义不变。

## 范围与不变项

- 只替换 `apps/admin/src/components/MarkdownEditor.vue` 及其子组件、编辑器工具模块。
- `PostEditorView.vue` 保留现有 props、事件和 `defineExpose` 调用方式，避免改动文章保存流程。
- 后端 API、数据库、Astro SSR Markdown 渲染链不改。
- 图片拖拽、粘贴和媒体库插入继续调用现有 `upload()`，禁止 base64 内嵌。
- 删除 Milkdown 依赖；只有在验证功能等价后才从 `apps/admin/package.json` 和锁文件移除。

## 功能等价清单

编辑器必须覆盖现有 Crepe/CommonMark/GFM 可编辑能力：

- 段落、标题 1–6、粗体、斜体、删除线、行内代码、链接。
- 无序/有序列表、任务列表、嵌套列表、引用、分割线。
- fenced 代码块及语言标记；代码内容按纯文本处理。
- GFM 表格：插入、增加/删除行列、对齐、单元格编辑。
- 图片块：上传、替换、删除、alt 文本和链接插入。
- Markdown 快捷输入（`# `、`- `、`1. `、`> `、``` 等）以及常用快捷键（撤销/重做、加粗、斜体、链接、列表）。
- 工具栏、块级插入菜单、链接编辑浮层、表格操作菜单。
- 拖拽/粘贴图片和文件；文件作为 Markdown 链接插入。
- 未支持的站点扩展语法（提示框、折叠、数学、Mermaid、视频、文件树等）必须原样保留，不能在加载和保存时丢失。

## 方案

采用“块模型 + contenteditable 渲染层 + Markdown 序列化”的分层实现：

1. `markdown-document.ts`：解析 Markdown 为块模型，序列化回 Markdown；为未知扩展建立 `raw` 块，保存原始文本。
2. `RichMarkdownEditor.vue`：管理文档状态、选区、输入法、撤销栈、拖拽/粘贴和事件发射。
3. `EditorToolbar.vue`：使用 PrimeVue `Toolbar`、`Button`、`ButtonGroup`、`Select`、`Popover`、`Dialog` 组装格式按钮和块插入。
4. `SlashMenu.vue`：使用 PrimeVue `Menu`/`Popover`，提供移动端可触控的块插入菜单。
5. `BlockInspector.vue`：用于图片、链接、代码语言、表格和 raw 块属性编辑。

不使用大段主题 CSS。布局和间距优先使用项目已有 PrimeVue/Tailwind 工具类；仅保留编辑区必要的语义样式（块间距、代码背景、表格边框、焦点态），并通过 PrimeVue CSS 变量适配主题。

## 编辑器交互

### 桌面端

- 顶部固定工具栏，滚动正文时保持可见。
- 块左侧显示悬浮操作按钮；鼠标不可用时仍可通过键盘和 `/` 菜单完成同样操作。
- 选中文本显示 Bubble `Popover`，提供粗体、斜体、链接、代码和删除线。
- 拖拽文件显示上传状态；上传完成后在原选区插入结果。

### 移动端和触摸设备

- 工具栏横向滚动，按钮命中区至少 44px；不依赖 hover 才能发现操作。
- 块操作改为点击后打开底部 `Drawer`/`Dialog`，避免悬浮按钮遮挡正文。
- 斜杠菜单和属性编辑使用全宽底部面板，支持安全区内边距和软键盘顶起。
- 编辑区正文使用单列窄边距，避免双指缩放和横向溢出；表格允许横向滚动。
- 触摸拖拽图片提供明确的上传中/失败状态，失败时保留原块并允许重试。

## Markdown 兼容策略

- 普通块采用规范化序列化，保证重复打开/保存不会产生无意义的格式抖动。
- raw 块记录原始 Markdown、起止位置和块类型；编辑器只显示摘要和“编辑源码”入口。
- 解析失败时进入安全降级：保留完整原文为单个 raw 文档，不覆盖用户内容，并发出 `error` 事件。
- 图片 alt 中的宽度令牌、站点自定义 directive 属性不得被清理。

## 组件接口

保持现有接口：

```ts
defineProps<{ modelValue: string }>()
defineEmits<{
  "update:modelValue": [value: string]
  error: [message: string]
}>()
defineExpose({ rememberSelection, insert })
```

`insert(markdown)` 由媒体库调用，用安全的 Markdown 片段插入当前选区；当当前块不可直接插入时，创建新的段落或 raw 块。

## 错误和状态

- 上传期间禁用重复上传，但允许继续编辑其他文本。
- 上传失败通过现有 `error` 事件显示，不清空编辑器内容。
- 外部 `modelValue` 变化只在内容确实不同且编辑器非 composing 状态时应用，避免自动保存回填打断输入法。
- 组件卸载前销毁监听器、对象 URL 和拖拽状态。

## 验证

- `markdown-document` 单元测试覆盖普通块、GFM 表格、代码块、图片、未知 directive、解析失败保留原文和往返稳定性。
- 编辑器组件测试覆盖 `v-model`、工具栏命令、快捷输入、粘贴/拖拽上传、`insert()` 暴露方法和移动端菜单可达性。
- 运行 `pnpm --dir apps/admin type-check`、`pnpm --dir apps/admin test`、`pnpm --dir apps/admin build`。
- 手工验收桌面鼠标、键盘、iOS/Android 触摸尺寸下的编辑、表格、图片上传、预览和自动保存。

## 迁移顺序

1. 新增文档模型和 Markdown 往返测试。
2. 新增 PrimeVue 编辑器组件和桌面交互。
3. 加入 raw 块、媒体上传和 `defineExpose` 兼容层。
4. 加入移动端工具栏、底部操作面板和触摸验收。
5. 替换 `MarkdownEditor.vue` 导出，运行完整检查。
6. 删除 Milkdown 依赖和死代码，更新锁文件。
