# MarkFlow

MarkFlow 是一个 **local-first 的 Markdown 知识工作区**。它直接工作在用户授权的本地文件夹上，以普通 Markdown 文件作为主要写作格式，同时提供接近 Typora 的块级所见即所得编辑、整篇源码模式、Wiki Link、反向链接、Mermaid、数学公式、Excalidraw、图片/PDF 预览和本地文件管理。

> 核心原则：**磁盘上的文件是最终数据源，编辑器状态只是交互中的工作副本。**

因此 MarkFlow 不要求把笔记导入专有数据库；工作区仍然可以被 VS Code、Git、Obsidian 或其他普通文件工具读取和管理。

![Markdown Editor](https://img.shields.io/badge/Editor-Markdown-blue)
![Excalidraw](https://img.shields.io/badge/Drawing-Excalidraw-6965db)
![Mermaid](https://img.shields.io/badge/Diagrams-Mermaid-ff6b6b)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 核心能力

### Typora 风格 Markdown 编辑

默认编辑模式采用“活动块源码 + 其他块渲染”的混合模型：

- 未激活块保持最终渲染效果。
- 点击一个块后，只暴露该块的 Markdown source。
- 段落、标题、列表、引用、代码块、数学公式和表格按 Markdown 语义分块，而不是逐行拆分。
- 代码、数学公式、Mermaid 和表格编辑时保留实时 Preview。
- `Enter` 在普通段落中创建真正的新 Markdown 段落。
- `Shift+Enter` 在段落、列表和引用中写入真正的 Markdown hard line break。
- 列表、任务列表和引用支持连续输入与自然退出。
- 块首 `Backspace` 可以和上一块合并。
- 光标在块边界时可以使用 `↑ / ↓` 进入相邻块。
- 普通渲染块点击后会估算对应源码位置。
- GFM 表格支持更精确的 cell 映射：点击 rendered cell 后直接进入 table source 并选中对应 Markdown cell。
- `Ctrl/Cmd + B`、`Ctrl/Cmd + I`、`Ctrl/Cmd + K` 直接作用于活动块。

### Source Code Mode

MarkFlow 同时保留显式的整篇 Markdown 源码模式：

- `Ctrl/Cmd + /` 或状态栏按钮切换 WYSIWYG / Source Mode。
- 两种视图共享同一份 `content`、undo/redo、dirty state、自动保存和文件写入流程。
- 切换时按当前滚动比例尽量保持阅读位置。
- Source Mode 支持 `Tab` 多行缩进和 `Shift+Tab` 反向缩进。
- 格式快捷键和 Toolbar 插入仍然可用。

### Markdown / GFM / KaTeX / Mermaid

支持：

- GitHub Flavored Markdown
- 标题、粗体、斜体、删除线、列表、任务列表、引用、表格、分割线
- fenced code block + syntax highlighting
- 无语言标签的一行 fenced code 仍正确作为 block code 渲染
- KaTeX 行内和块级数学公式
- Mermaid 流程图、时序图、甘特图等
- 相对路径本地图片
- 外部链接

渲染后的代码块和 Mermaid 提供轻量 Copy 操作。Mermaid 使用 `securityLevel: strict`，并限制异常大的输入规模。

### Slash Menu

在活动块空行开头输入 `/` 可插入：

- H1 / H2 / H3
- bullet / numbered list
- Todo
- quote / divider
- code block
- math block
- table
- Mermaid
- link / image
- Wiki Link

菜单支持过滤、`↑ / ↓`、Enter、Tab 和 Esc。

### Task checkbox 直接操作

渲染状态下可直接点击：

```markdown
- [ ] Todo
- [x] Done
```

状态会回写对应 Markdown marker，而不是建立第二份任务数据。

## Local-first Workspace

MarkFlow 使用 File System Access API 直接工作在本地目录：

- 递归加载目录树
- 创建文件 / 文件夹
- 嵌套路径重命名
- 删除
- 保存到实际磁盘
- 图片 / PDF / Excalidraw 与 Markdown 共用一个工作区
- 刷新后尝试恢复最近目录和文件
- 权限失效时要求通过用户操作重新授权，而不是后台强制 requestPermission

目录扫描默认跳过 `.git`、`node_modules`、`.next`。

### 文件类型

| 类型 | 当前行为 |
|---|---|
| Markdown / text | WYSIWYG + Source Mode 编辑 |
| `.excalidraw` | Excalidraw 编辑 |
| image | 内嵌预览 |
| PDF | 内嵌预览 |
| binary / other | 在目录树中浏览和管理 |

### 自动保存与 dirty state

文本编辑基本生命周期：

```text
edit
  → update working copy
  → mark dirty
  → debounce
  → write captured snapshot
  → compare with latest snapshot
  → mark clean only if they still match
```

此外：

- 切换文件时尝试 flush 上一份 dirty local file。
- 页面隐藏时尝试保存活动文件。
- `beforeunload` 检查整个工作区，而不是只检查当前文件。
- `Ctrl/Cmd + S` 保留手动保存。
- 保存 A 文件时即使随后切到 B，也不会错误地把 B 标成已保存。

## Wiki Link 与知识库能力

支持：

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|显示文本]]
```

当前行为：

- 点击 Wiki Link 打开目标文件。
- 同名文件按确定的路径和同目录优先规则解析。
- Backlinks 从当前 Markdown source 实时计算。
- 重命名 Markdown note 时，只修改重命名前真正解析到该文件的 Wiki Link。
- `[[Note]]`、显式扩展名、路径和 alias 会尽量保持原来的语法形式。

知识图谱关系始终可以从普通 Markdown 文件重新构建。

## 搜索与导航

### Quick Open / Command Palette

`Ctrl/Cmd + P`：

- 搜索文件名和路径
- 最近访问文件优先
- 打开 Markdown、图片、PDF、Excalidraw 等
- 显示当前文件和 dirty 状态
- 执行保存、全文搜索、专注模式、侧边栏切换等高频命令

### 全文搜索

`Ctrl/Cmd + F`：

- 搜索当前加载工作区的文本内容
- 展示匹配上下文
- 点击或使用 Enter / 前后导航真正切换结果文件
- 清空 query 会同步清空旧结果

## Excalidraw

集成 `@excalidraw/excalidraw`：

- 创建和编辑 `.excalidraw` / `.excalidraw.json`
- 跟随亮色 / 暗色主题
- 纳入同一工作区文件树
- 保留 Excalidraw 自带图片导出能力

## 快捷键

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + P` | Quick Open / Command Palette |
| `Ctrl/Cmd + F` | 全文搜索 |
| `Ctrl/Cmd + S` | 手动保存 |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + /` | WYSIWYG / Source Mode |
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + K` | Link |
| `Enter` | 新段落 / 延续 list 或 quote |
| `Shift+Enter` | paragraph/list/quote hard line break |
| `Tab` | 缩进；Source Mode 支持多行缩进 |
| `Shift+Tab` | Source Mode 反向缩进 |
| `/`（空行） | Slash Menu |
| `Esc` | 退出活动块；Focus Mode 下退出专注模式 |

## 工程结构

```text
src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── editor.css
│   └── editor-polish.css
├── components/
│   ├── workspace/
│   │   └── WorkspacePage.tsx
│   └── editor/
│       ├── TyporaEditor.tsx
│       ├── TyporaEditorCore.tsx
│       ├── markdown/
│       │   ├── markdown-blocks.ts
│       │   └── MarkdownRenderer.tsx
│       ├── PersistenceRuntime.tsx
│       ├── WikiLinkRenameRuntime.tsx
│       ├── QuickOpen.tsx
│       ├── Sidebar.tsx
│       ├── Toolbar.tsx
│       └── BacklinksPanel.tsx
├── hooks/
│   ├── useWorkspaceDirectory.ts
│   └── useAppPreferences.ts
├── lib/
│   ├── file-system.ts
│   ├── file-operations.ts
│   ├── workspace-loader.ts
│   ├── workspace-persistence.ts
│   └── wiki-links.ts
└── store/
    └── editor-store.ts

tests/
└── core-semantics.test.mjs
```

更完整的工程边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，具体功能行为见 [`FEATURES.md`](FEATURES.md)。

## 技术栈

- Next.js 16 / React 19
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Zustand
- react-markdown + remark-gfm + remark-math
- KaTeX
- react-syntax-highlighter
- Mermaid 11
- Excalidraw 0.18
- File System Access API

## 开发

### 环境

- Node.js 24（CI 当前版本）
- 完整本地目录能力建议使用 Chrome / Edge 等 Chromium 浏览器

### 启动

```bash
npm install --legacy-peer-deps
npm run dev
```

### 验证

```bash
npm run lint
npm test
npm run build
```

`npm test` 使用 Node 24 自带的 `node:test`，当前不额外引入 Jest/Vitest。第一层回归测试覆盖：

- Markdown semantic block grouping
- Wiki Link extraction / duplicate resolution / rename rewrite
- workspace path / filename helper semantics

CI 对 pull request 和 `main` push 都执行：

```text
install → lint → core tests → production build
```

## 浏览器说明

核心 Markdown 编辑和渲染是 Web UI，但“打开并写回真实本地文件夹”依赖 File System Access API。

- Chromium：主要完整目标环境。
- Safari / Firefox：部分 filesystem 能力不可用或行为不同。

## 当前工程方向

已经完成的能力不会继续留在 roadmap。当前真正值得继续推进的是：

1. 从“滚动比例”升级为 source-position-aware 的 WYSIWYG / Source Mode 精确位置映射。
2. Workspace Refresh：安全处理 VS Code / Explorer 等外部修改，不能覆盖 MarkFlow 内的 dirty 内容。
3. 将 typed CRUD result 从 UI adapter 下沉到真正的 store/filesystem action boundary。
4. 扩展自动测试到 table source mapping、键盘 transition、autosave race 和 browser integration。
5. 评估 inline Markdown marker 按焦点显隐，而不破坏 Markdown 作为唯一持久数据源。
6. 建立 WorkspaceAdapter 后再推进 Tauri desktop shell。
7. 单独整理 lockfile 与 React 19 / Excalidraw peer-range 依赖兼容债务。

## License

请以仓库中的 License 文件为准；若仓库尚未提供 License，则默认不授予额外开源许可。
