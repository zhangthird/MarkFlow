# MarkFlow 功能文档

本文档记录当前 `main` 方向下 MarkFlow 已经实现的产品行为。README 用于快速了解项目；本文件更关注“功能具体怎么工作”。工程边界与后续路线见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 1. Markdown 编辑模型

### 1.1 默认 WYSIWYG

MarkFlow 默认不是整篇 textarea，也不是每行独立编辑，而是“活动块源码 + 其他块渲染”的混合模型。

基本流程：

1. Markdown 被解析成语义块。
2. 未激活块由 `MarkdownRenderer` 渲染。
3. 点击某个块后，仅该块显示 Markdown 源码 textarea。
4. 其他块继续保持渲染状态。
5. 当前块失焦或按 Esc 后重新回到渲染状态。

当前识别的主要块类型：

- 标题
- 普通段落
- 有序/无序/任务列表
- blockquote
- fenced code block
- Mermaid fenced block
- block math
- GFM table
- thematic break
- 空块

### 1.2 多行结构

代码、数学公式和表格不会只编辑第一行，而是整个语义块一起进入编辑状态。

对于以下复杂块，编辑源码时会同时保留实时 Preview：

- code
- Mermaid
- block math
- table

这样可以一边修改源码，一边看到最终渲染结果。

### 1.3 Enter / Backspace / 方向键

普通段落与标题：

- `Enter` 创建新的 Markdown 段落，而不是只插入一个最终会被 Markdown 合并的软换行。
- 新段落创建后，编辑焦点进入下一段。

列表：

- `- item` 按 Enter 自动延续 `- `。
- `1. item` 自动递增编号。
- `- [ ] item` 自动创建下一条未完成任务。
- 空列表项再次 Enter 会退出列表。

引用：

- `> quote` 按 Enter 自动延续 `> `。
- 空引用行再次 Enter 可退出引用。

块导航：

- 活动块首部按 Backspace 可与上一块合并。
- 光标在源码块起点时按 `↑` 可进入上一块。
- 光标在源码块末尾时按 `↓` 可进入下一块。

代码、block math、table 内的 Enter 保持结构块自己的原始换行语义。

### 1.4 点击后的光标位置

从渲染状态点击一个块时，MarkFlow 会根据：

- 点击的水平位置
- 点击的垂直位置
- 块中的源文本行数
- 标题、列表、任务项、引用等 Markdown 前缀

估算源码 caret 的初始位置，避免每次都跳到块末尾。

这是启发式映射，不是完整 AST position mapping，因此复杂 inline syntax 仍可能存在少量偏差。

## 2. Source Code Mode

MarkFlow 还提供显式的整篇 Markdown 源码模式。

切换方式：

- `Ctrl/Cmd + /`
- 状态栏 `Source / WYSIWYG` 按钮

两种模式共享同一个 Zustand 文档状态，因此：

- 不存在第二份文档副本。
- undo/redo 共用同一历史。
- dirty state 共用。
- 自动保存共用。
- 切回 WYSIWYG 后立即按最新 Markdown 重新渲染。

模式切换时会尽量按当前滚动比例恢复阅读位置，减少长文档从中间位置切换后跳回顶部的问题。

源码模式支持：

- `Ctrl/Cmd + B`：粗体
- `Ctrl/Cmd + I`：斜体
- `Ctrl/Cmd + K`：链接
- `Tab`：当前光标缩进或多行统一缩进
- `Shift + Tab`：当前行或选中多行反向缩进

## 3. Markdown 渲染

### 3.1 GFM

支持 `remark-gfm` 提供的常用 GitHub Flavored Markdown：

```markdown
# Heading

**bold** *italic* ~~strike~~

- item
- [ ] task

> quote

| A | B |
|---|---|
| 1 | 2 |
```

### 3.2 数学公式

基于 `remark-math + rehype-katex + KaTeX`。

行内：

```markdown
$E = mc^2$
```

块级：

```markdown
$$
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

### 3.3 代码块

fenced code 支持语法高亮，并识别语言标签：

````markdown
```typescript
const value = 1
```
````

渲染状态下代码块提供轻量 Copy 按钮；复制操作不会触发外层 Markdown 块进入源码编辑。

### 3.4 Mermaid

Mermaid fenced block：

````markdown
```mermaid
graph TD
  A --> B
```
````

行为：

- 渲染为 Mermaid 图表。
- 源码编辑时保留实时 Preview。
- 渲染状态可复制 Mermaid source。
- Mermaid 使用 `securityLevel: strict`。
- 对图表文本大小和边数量设置限制，降低异常输入带来的资源消耗。

### 3.5 图片

对于 Markdown 中的相对图片路径，MarkFlow 会基于当前文件路径在已加载的工作区树中解析对应图片，并使用本地 Blob URL 预览。

HTTP(S)、data URL 和 blob URL 保持原样。

## 4. 任务列表直接操作

GFM checkbox 在渲染状态下可直接点击。

例如：

```markdown
- [ ] Write README
```

点击后直接更新为：

```markdown
- [x] Write README
```

checkbox 会按当前 Markdown 块中的任务项顺序映射回对应 source marker。

## 5. Slash Menu

在活动块的空行起始位置输入 `/` 可打开 Slash Menu。

主要命令包括：

- H1 / H2 / H3
- bullet list
- numbered list
- todo
- quote
- divider
- code block
- math block
- table
- Mermaid
- link
- image
- Wiki Link

菜单会尽量显示在 textarea caret 附近。

键盘操作：

- `↑ / ↓`：选择命令
- `Enter`：确认
- `Tab`：确认
- `Esc`：关闭
- 继续输入：过滤命令

## 6. Toolbar

工具栏格式化不会再把整个文档切成源码。

当当前存在活动块时，插入/包裹操作直接作用于活动 textarea；没有活动块时，会选择最近活动或合适的默认块进入编辑。

主要操作：

- bold
- italic
- inline code
- inline math
- heading
- lists
- quote
- code block
- math block
- link
- image
- table
- divider
- save
- undo/redo
- search
- theme/language
- focus mode
- PDF print/export

## 7. 本地工作区

### 7.1 目录加载

`useWorkspaceDirectory` 负责打开/恢复工作区；`workspace-loader.ts` 负责目录扫描。

默认跳过：

- `.git`
- `node_modules`
- `.next`

文件读取在同一级目录中尽量并发执行，避免大目录完全串行加载。

### 7.2 目录恢复

目录 handle 会持久化到 IndexedDB。

刷新页面时：

1. 尝试找到上次的目录 handle。
2. 查询当前是否仍有授权。
3. 如果已有权限，恢复工作区。
4. 如果权限已失效，不主动在启动阶段调用 `requestPermission()`，而是提示用户通过打开目录操作重新授权。

这样可以避免浏览器“必须由用户手势触发权限请求”的限制导致恢复流程卡死。

### 7.3 文件类型

| File type | Behavior |
|---|---|
| Markdown | WYSIWYG + Source Mode |
| text | 文本编辑 |
| Excalidraw | 绘图 |
| image | 主区域预览 |
| PDF | iframe 内嵌预览 |
| binary/other | 目录管理与占位信息 |

## 8. 文件 CRUD

支持：

- 创建文件
- 创建文件夹
- 删除
- 重命名
- 嵌套路径操作

文件系统逻辑集中在 `src/lib/file-system.ts`。

关键行为：

- 创建时解析真正的父目录，而不是始终写到根目录。
- 删除文件夹使用递归删除。
- 重命名目录时同步更新所有 descendant path。
- 浏览器 File System Access API 缺少稳定的跨浏览器原生 rename，当前采用保守的 copy-then-delete 方案。
- copy 失败时不删除原条目。
- 文件操作 UI 会等待文件树出现预期变化后再报告成功，避免明显的“假成功”提示。
- 删除操作有确认交互。

## 9. 自动保存与 dirty state

文本文件采用防抖自动保存。

核心约束：

```text
isModified = true
```

表示内存快照比已知磁盘快照更新。

一次异步保存只能在以下条件成立时清除 dirty：

```text
刚刚写入磁盘的 snapshot === 当前最新 snapshot
```

如果写盘期间用户又继续输入，旧保存完成不会把新内容错误标记为 clean。

额外行为：

- 切换文件时立即尝试 flush 上一份 dirty local file。
- 页面隐藏时尝试保存当前文件。
- `beforeunload` 检查整个文件树，而不是只检查 currentFile。
- `Ctrl/Cmd + S` 仍可手动保存。

## 10. Undo / Redo

历史按文件隔离。

- `Ctrl/Cmd + Z`
- `Ctrl/Cmd + Shift + Z`
- `Ctrl/Cmd + Y`

切换文件后不会把上一文件的编辑历史应用到新文件。

undo/redo 同时更新：

- editor content
- currentFile content
- 对应 file tree node
- dirty state

## 11. Wiki Link 与 Backlinks

支持：

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|Alias]]
```

解析规则优先考虑：

1. 明确路径
2. 完整文件名 / 去扩展名文件名
3. 同名冲突时优先当前 source note 所在目录
4. 确定性的 fallback candidate

点击 Wiki Link 会打开目标文件。

Backlinks 从当前工作区 Markdown source 中实时推导，不维护单独数据库。

### Rename refactor

重命名 Markdown 笔记时，MarkFlow 会检查哪些 Wiki Link 在重命名前真正解析到了该文件，只更新这些引用。

因此不会因为存在两个同名 `Note.md` 就简单把整个工作区中的 `[[Note]]` 全部替换。

原始链接形式会尽量保持，例如：

```text
[[Note]]            → [[Renamed]]
[[Note.md]]         → [[Renamed.md]]
[[folder/Note]]     → [[folder/Renamed]]
[[Note|Alias]]      → [[Renamed|Alias]]
```

## 12. Quick Open / Command Palette

快捷键：

```text
Ctrl/Cmd + P
```

功能：

- 文件名/路径搜索
- 最近打开文件排序
- 打开 Markdown、图片、PDF、Excalidraw 等
- 标记当前文件和 dirty file
- 保存
- 打开全文搜索
- 专注模式
- 侧边栏切换

最近文件信息保存在浏览器本地状态中。

## 13. 全文搜索

`Ctrl/Cmd + F`：

- 搜索工作区已加载的文本文件
- 展示上下文
- 结果前后导航
- Enter/导航按钮实际切换目标文件
- 清空 query 时同步清空旧结果

## 14. Excalidraw

使用 `@excalidraw/excalidraw`。

- 动态加载，避免 SSR 问题。
- 跟随主题。
- `.excalidraw` / `.excalidraw.json` 纳入工作区文件树。
- 支持 Excalidraw 自带导出能力。

## 15. Focus / Theme / Language

### Focus Mode

隐藏主要应用 chrome，减少写作干扰。`Esc` 退出。

### Theme

亮色/暗色偏好保存到浏览器本地状态；Mermaid、Excalidraw 和 Markdown renderer 跟随主题。

### Language

支持中文/英文 UI 切换并持久化偏好。

## 16. 快捷键汇总

### Global

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + P` | Quick Open |
| `Ctrl/Cmd + F` | Search |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + /` | WYSIWYG / Source Mode |
| `Esc` | Exit active block / Focus Mode |

### Markdown editing

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + K` | Link |
| `Enter` | New paragraph / continue list or quote |
| `Tab` | Indent |
| `Shift + Tab` | Source Mode outdent |
| `↑ / ↓` | Move across block boundary when caret is at boundary |
| `/` at empty line | Slash Menu |

## 17. 浏览器支持

完整 local-folder 工作流依赖 File System Access API。

- Chromium 系浏览器：主要目标环境。
- Safari / Firefox：Markdown 编辑和部分页面能力可以工作，但直接本地文件夹访问能力可能不可用或不完整。

## 18. 当前已知边界

MarkFlow 目前已经明显接近 Typora 的 block-level mixed editing，但还不是完整的富文本 inline editor。

当前主要边界：

- `**bold**`、`[link](url)`、inline math 等 meta syntax 仍以活动块源码的方式显露，而不是精确到当前 inline token 才显露。
- 渲染 DOM 与 Markdown source 的光标映射目前是启发式，而不是基于 AST source position 的一一映射。
- 表格目前按整个 table block 编辑，尚未做到点击 rendered cell 后精确选中对应 source cell。
- `Shift+Enter` 的 WYSIWYG hard-line-break 语义仍需进一步统一。
- 浏览器没有通用 filesystem watch API，外部编辑器修改后的自动刷新仍需设计 Workspace Refresh/diff。
- 桌面端尚未加入正式的 Workspace Adapter / Tauri implementation。

这些内容应作为后续工程优化重点，而不是通过继续增加独立编辑模式绕开。
