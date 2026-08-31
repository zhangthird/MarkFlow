# MarkFlow 功能文档

本文档描述 MarkFlow 当前已经实现的产品行为。快速介绍见 [`README.md`](README.md)，工程边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 1. Markdown 编辑

### 1.1 活动块 WYSIWYG

MarkFlow 默认采用：

```text
inactive block → rendered Markdown
active block   → Markdown source textarea
```

Markdown 会先分成语义块，而不是按每一行拆开。主要块类型：

- heading
- paragraph
- ordered / unordered / task list
- blockquote
- fenced code
- Mermaid fenced block
- block math
- GFM table
- thematic break
- blank block

代码、Mermaid、数学公式和 table 编辑时会同时显示 live Preview。

### 1.2 Enter / Shift+Enter

普通段落：

- `Enter` 创建新的 Markdown paragraph。
- `Shift+Enter` 写入 Markdown hard line break：两个空格 + 换行。

列表：

- `- item` 自动延续 bullet。
- `1. item` 自动递增编号。
- `- [ ] item` 自动延续 task item。
- 空 item 再按 Enter 退出列表。
- `Shift+Enter` 保持在当前 list item 内，并写入 continuation indentation。

blockquote：

- Enter 自动延续 `>`。
- 空 quote line 再 Enter 退出引用。
- `Shift+Enter` 写入 hard break 并保留 quote prefix。

code / block math / table 内部保留结构块自己的原始换行行为。

### 1.3 块导航与编辑

- 活动块开头按 Backspace 可与上一块合并。
- caret 在块起点时按 `↑` 可进入上一块。
- caret 在块末尾时按 `↓` 可进入下一块。
- `Esc` 退出活动块。
- `Ctrl/Cmd+B`、`Ctrl/Cmd+I`、`Ctrl/Cmd+K` 操作当前 selection。
- Toolbar 不会再把整篇文档意外切成源码。

### 1.4 点击到 source position

普通渲染块使用点击位置、块高度、源码行数和 Markdown prefix 做启发式 caret 估算。

GFM table 使用专门的 source mapping：

- rendered header row → source header row；
- rendered body row 映射时跳过 GFM divider row；
- cell delimiter 解析忽略 `\|`；
- backtick inline code 中的 `|` 不作为 separator；
- 点击 cell 后直接选中对应 Markdown cell source。

## 2. Source Code Mode

切换：

```text
Ctrl/Cmd + /
```

或使用底部状态栏按钮。

Source Mode 与 WYSIWYG 使用同一个 `content`：

- 同一个 undo / redo history；
- 同一个 dirty state；
- 同一个 autosave；
- 同一个 filesystem write pipeline。

当前切换会按滚动比例恢复阅读位置。

Source Mode 额外支持：

- Tab 当前行 / 多行缩进；
- Shift+Tab 当前行 / 多行反向缩进；
- Bold / Italic / Link 快捷键；
- Toolbar insertion。

## 3. Markdown 渲染

### GFM

支持常用 GitHub Flavored Markdown，包括：

- headings
- emphasis / strong / strikethrough
- lists / task lists
- blockquotes
- tables
- links / images
- inline code / fenced code

### Code

- fenced code block 使用 syntax highlighting；
- 语言标签显示在代码区域；
- rendered block 提供 Copy；
- Copy 不会触发进入活动块；
- 无语言标签的一行 fenced code 仍保持 block rendering，不会误判为 inline code。

### Math

使用 `remark-math + rehype-katex + KaTeX`：

```markdown
$E = mc^2$
```

以及：

```markdown
$$
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

### Mermaid

- fenced `mermaid` block 渲染图表；
- 编辑时 live Preview；
- rendered diagram 可复制 source；
- `securityLevel: strict`；
- 配置输入规模限制，降低异常文档的资源消耗风险。

### Local images

相对图片路径会基于当前 Markdown 文件所在目录解析到已加载 workspace 中的 image node，并使用 Blob URL 预览。

HTTP(S) / data / blob URL 保持原样。

## 4. Task checkbox

渲染状态下可直接点击 GFM checkbox：

```markdown
- [ ] Todo
```

变为：

```markdown
- [x] Todo
```

结果直接回写 Markdown source。

## 5. Slash Menu

在活动块空行开头输入 `/`。

支持插入：

- headings
- bullet / ordered list
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

键盘支持过滤、`↑ / ↓`、Enter、Tab、Esc。

## 6. Local-first Workspace

### Directory lifecycle

`useWorkspaceDirectory` 负责打开和恢复工作区，`workspace-loader.ts` 负责扫描目录。

默认跳过：

- `.git`
- `node_modules`
- `.next`

目录 handle 会存入 IndexedDB。刷新恢复时只查询已有权限；如果权限失效，要求用户重新执行打开目录操作。

### Workspace Refresh

Quick Open 提供“从磁盘刷新工作区”。它用于接收 VS Code、Explorer 或其他外部工具对工作区文件产生的变化。

当前 refresh policy：

1. 递归收集整个 workspace 的 dirty file path。
2. 只要存在任意 dirty file，就取消 refresh，不覆盖 MarkFlow 内存中的未保存编辑。
3. clean workspace 才重新执行 `scanWorkspaceDirectory`，让磁盘重新成为当前 snapshot。
4. 原 current file path 仍存在时继续保持该文件；否则选择第一个可用文件。
5. 接受新 snapshot 后重置当前 undo history，并清空 stale search query/result。

MarkFlow 尚未维护 base/local/disk 三方版本，因此 dirty 状态下不会自动猜测 merge 结果。后续如果加入 conflict UX，应建立显式 diff/choice，而不是放宽这一安全约束。

### File types

| Type | Behavior |
|---|---|
| Markdown | WYSIWYG + Source Mode |
| text | text editing |
| Excalidraw | drawing editor |
| image | preview |
| PDF | iframe preview |
| other/binary | file-tree management |

## 7. File CRUD

支持：

- nested create
- rename
- recursive delete
- folder descendant path update
- local disk write

文件系统 primitive 位于 `src/lib/file-system.ts`。

UI-facing `src/lib/file-operations.ts` 提供结构化结果：

```text
success
invalid_name
already_exists
parent_not_found
not_found
unchanged
io_error
```

Sidebar 会等待预期 file-tree postcondition 再显示成功，降低“界面成功、磁盘失败”的假成功风险。

浏览器缺乏统一可靠的 rename primitive，因此当前 rename 使用保守的 copy-then-delete；copy 失败时保留原 entry。

## 8. Autosave / dirty state

文本编辑后：

```text
edit
→ mark dirty
→ debounce
→ write captured snapshot
→ compare written snapshot with latest state
→ clear dirty only if equal
```

因此旧的异步写入完成不会把更新后的内容错误标成 clean。

额外规则：

- file switch 尝试 flush previous dirty file；
- page hidden 尝试 flush active file；
- beforeunload 检查整个 workspace tree；
- `Ctrl/Cmd+S` 可手动保存。

## 9. Undo / Redo

历史按文件隔离。

- `Ctrl/Cmd+Z`
- `Ctrl/Cmd+Shift+Z`
- `Ctrl/Cmd+Y`

切换文件不会共享历史。

## 10. Wiki Link / Backlinks

支持：

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|Alias]]
```

解析顺序主要考虑：

1. explicit path；
2. filename / filename without extension；
3. duplicate 时 source note 同目录优先；
4. deterministic fallback。

Backlinks 由 Markdown source 推导，不单独持久化 graph database。

### Rename refactor

重命名 note 时，只重写重命名前真正解析到目标文件的 Wiki Link。

例如：

```text
[[Note]]            → [[Renamed]]
[[Note.md]]         → [[Renamed.md]]
[[folder/Note]]     → [[folder/Renamed]]
[[Note|Alias]]      → [[Renamed|Alias]]
```

这比 workspace-wide string replace 更安全，特别是同名 note 场景。

## 11. Quick Open / Search

### Quick Open

`Ctrl/Cmd+P`：

- filename/path search；
- recent files ranking；
- open Markdown/image/PDF/Excalidraw；
- dirty/current indicators；
- save/search/workspace refresh/focus/sidebar commands。

### Full-text search

`Ctrl/Cmd+F`：

- workspace text search；
- context display；
- Enter / previous / next 真正切换结果；
- query 清空时同步清空旧 result。

## 12. Excalidraw

- `.excalidraw` / `.excalidraw.json`；
- dynamic loading；
- theme sync；
- workspace tree integration；
- Excalidraw 内置图片导出。

## 13. Workspace chrome / Focus / Theme / Language

### Explorer / Link Inspector

- 左侧 Explorer 使用紧凑文件树，显示 workspace 名称、文件数量、目录数量和 dirty 数量。
- 当前文件使用低对比选中底色和左侧窄指示条，减少大面积高亮对写作区域的干扰。
- 左侧栏支持 200–420px 拖拽调整宽度，双击分隔线恢复 260px。
- Explorer 的显示/隐藏状态与宽度会保存在浏览器偏好中；Toolbar、Quick Open 和其他 store caller 产生的状态变化都会统一持久化。
- 左侧栏由 Toolbar 作为唯一显示/隐藏入口，不再在编辑区重复提供悬浮打开按钮。
- 右侧 Link Inspector 将 backlinks 与 outgoing Wiki Links 组织为连续 inspector 分区，并显示当前文件路径、引用上下文和缺失目标状态。
- 右侧栏支持 260–420px 拖拽调整宽度，双击分隔线恢复 304px。
- Link Inspector 的开关和宽度同样会跨刷新恢复；右侧关闭后仍保留编辑区边缘的轻量打开按钮。
- 调整右栏宽度时会结合当前 Explorer 宽度，为中央编辑区预留最小空间，降低窄窗口下正文被双侧栏挤压的情况。

### Focus / Theme / Language

- Focus Mode 隐藏主要 chrome，Esc 退出。
- Light / Dark preference 持久化。
- Mermaid / Markdown / Excalidraw 跟随主题。
- 中文 / 英文 UI preference 持久化。

## 14. 快捷键

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+P` | Quick Open |
| `Ctrl/Cmd+F` | Search |
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` | Redo |
| `Ctrl/Cmd+/` | WYSIWYG / Source Mode |
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Italic |
| `Ctrl/Cmd+K` | Link |
| `Enter` | New paragraph / continue list or quote |
| `Shift+Enter` | Markdown hard break in paragraph/list/quote |
| `Tab` | Indent |
| `Shift+Tab` | Source Mode outdent |
| `↑ / ↓` | Adjacent block navigation at caret boundary |
| `/` | Slash Menu on empty source line |
| `Esc` | Exit block / Focus Mode |

## 15. Regression tests

CI 使用 Node 24 自带 `node:test`，无需额外测试框架依赖。

当前 `tests/core-semantics.test.mjs` 覆盖第一层高风险纯语义：

- Markdown semantic block grouping；
- paragraph/list/table/fenced-code partition；
- Wiki Link alias extraction；
- duplicate-name same-directory resolution；
- rename rewrite 只修改真正解析到目标 note 的链接；
- workspace path helpers；
- filename validation；
- panel preference width clamping 与持久化值解析。

标准 CI：

```text
npm install
→ npm run lint
→ npm test
→ npm run build
```

仍需后续扩展：

- table source mapping edge cases；
- keyboard transition tests；
- autosave race tests；
- workspace refresh dirty/scan edge cases；
- browser/File System Access integration tests。

## 16. 当前边界

MarkFlow 已经形成稳定的 block-level mixed editor，但尚不是完整 inline rich-text engine。

当前主要边界：

- `**bold**`、`[link](url)`、inline math 等 meta syntax 在活动块层级显露，而不是只在当前 inline token 获得 focus 时显露。
- 普通 rendered DOM → source position 仍以启发式映射为主；table cell 已有专门 range mapping。
- WYSIWYG / Source Mode 目前按 scroll ratio 保持位置，而不是 exact source position / selection mapping。
- Workspace Refresh 已能安全重新扫描 clean workspace，但尚没有 filesystem watch、三方 diff 或 conflict resolution UI。
- typed CRUD result 目前仍是 UI-facing adapter，尚未完全下沉到 store action boundary。
- desktop WorkspaceAdapter / Tauri shell 尚未正式加入。

这些是下一阶段工程演进方向，而不是通过再建立一套独立文档数据模型来绕过。
