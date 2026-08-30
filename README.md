# MarkFlow

MarkFlow 是一个 **local-first 的 Markdown 知识工作区**。它直接工作在用户选择的本地文件夹上，以普通 Markdown 文件作为主要写作格式，同时提供接近 Typora 的所见即所得编辑、源码模式、Wiki Link、反向链接、Mermaid、数学公式、Excalidraw、图片/PDF 预览和本地文件管理。

> 核心原则：**磁盘上的文件是最终数据源，编辑器状态只是交互中的工作副本。**

这意味着 MarkFlow 不要求把笔记导入专有数据库；工作区仍然可以被 VS Code、Git、Obsidian 或其他普通文件工具读取和管理。

![Markdown Editor](https://img.shields.io/badge/Editor-Markdown-blue)
![Excalidraw](https://img.shields.io/badge/Drawing-Excalidraw-6965db)
![Mermaid](https://img.shields.io/badge/Diagrams-Mermaid-ff6b6b)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)

## 当前主要能力

### Typora 风格 Markdown 编辑

MarkFlow 默认使用块级 WYSIWYG 编辑模型：

- 未激活的 Markdown 块保持渲染状态。
- 点击一个块后，只显示该块的 Markdown 源码，其余内容继续渲染。
- 段落、标题、列表、引用、代码块、数学公式和表格按 Markdown 语义分块，而不是简单逐行拆分。
- 代码、数学公式、Mermaid 和表格在源码编辑时保留实时预览。
- 普通段落中按 `Enter` 创建真正的新 Markdown 段落。
- 段落、列表和引用中按 `Shift+Enter` 写入真正的 Markdown hard line break；列表/引用会保留当前结构缩进或前缀。
- 列表、任务列表和引用支持连续输入与自然退出。
- 块首 `Backspace` 可与上一块合并；在块边界可使用方向键进入相邻块。
- 点击普通渲染内容时会尽量把源码光标定位到对应位置，而不是总跳到块末尾。
- 点击 GFM 表格中的某个 rendered cell 会直接进入 table source，并选中对应 Markdown cell；映射会跳过 divider row，并处理转义 pipe 与 inline code 中的 pipe。
- `Ctrl/Cmd + B`、`Ctrl/Cmd + I`、`Ctrl/Cmd + K` 可直接操作活动块。

### Source Code Mode

除了默认 WYSIWYG，MarkFlow 还提供显式的整篇 Markdown 源码视图：

- `Ctrl/Cmd + /` 在 WYSIWYG 与源码模式之间切换。
- 状态栏也提供切换按钮。
- 两种模式共享同一份 `content`、undo/redo、dirty state、自动保存和本地文件写入流程。
- 模式切换会尽量保留当前阅读位置，避免长文档跳回顶部。
- 源码模式支持 Tab/多行缩进、`Shift+Tab` 反向缩进以及常用 Markdown 格式快捷键。

### Markdown / GFM / 数学 / Mermaid

支持：

- GitHub Flavored Markdown（GFM）
- 标题、粗体、斜体、删除线、引用、列表、任务列表、表格、分割线
- fenced code block 与语法高亮
- KaTeX 行内/块级数学公式
- Mermaid 流程图、时序图、甘特图等
- 相对路径图片
- 外部链接

渲染后的代码块和 Mermaid 图表提供轻量的源码复制操作。Mermaid 使用较保守的安全配置，并限制异常大的图表输入。

### Slash 命令

在空行开始输入 `/` 可打开命令菜单，快速插入：

- 标题
- 无序/有序列表
- Todo
- 引用
- 代码块
- 数学公式块
- 表格
- Mermaid
- 链接和图片
- Wiki Link

菜单支持键盘过滤、上下选择、Enter 确认和 Esc 关闭。

### 任务列表直接交互

渲染状态下可以直接点击 GFM task checkbox：

```markdown
- [ ] Todo
- [x] Done
```

勾选状态会直接回写对应 Markdown 标记，不需要先切换到源码。

## Local-first Workspace

### 打开真实本地目录

MarkFlow 使用浏览器 File System Access API 访问用户授权的文件夹：

- 递归加载目录树
- 创建文件/文件夹
- 重命名
- 删除
- 保存到真实磁盘
- 刷新页面后尝试恢复最近打开的目录
- 浏览器权限失效时明确提示重新授权，而不是静默失败

目录扫描默认跳过 `.git`、`node_modules`、`.next` 等明显不适合作为知识内容加载的目录。

### 文件类型

| 类型 | 支持 |
|---|---|
| Markdown / text | WYSIWYG + Source Mode 编辑 |
| `.excalidraw` | Excalidraw 绘图 |
| 图片 | 内嵌预览 |
| PDF | 内嵌预览 |
| 其他二进制文件 | 在目录树中浏览与管理 |

### 保存与恢复

文本编辑的基本生命周期是：

```text
edit
  → mark dirty
  → debounce
  → write snapshot to disk
  → verify that the saved snapshot is still current
  → mark clean
```

MarkFlow 会：

- 自动保存文本修改。
- 切换文件时尝试立即刷出上一份 dirty 文件。
- 页面隐藏时尝试保存活动文件。
- 关闭页面前检查整个工作区，而不只检查当前文件。
- 保留 `Ctrl/Cmd + S` 手动保存。

异步保存完成后只有在“写出的快照仍然是最新内容”时才会清除 dirty 标记，避免用户继续输入时旧保存结果覆盖新状态。

## Wiki Link 与知识库能力

支持：

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|显示文本]]
```

当前能力包括：

- 点击 Wiki Link 跳转目标文件。
- 同名笔记优先按确定的路径/同目录规则解析。
- 右侧 Backlinks 面板显示引用当前笔记的文件。
- 重命名 Markdown 笔记时维护真正解析到该文件的 Wiki Link 引用。
- 不使用简单的全局字符串替换，因此同名文件场景下更安全。

Backlinks 和链接关系都从 Markdown 源文本计算，不存成独立数据库。

## 搜索与快速打开

### Quick Open

`Ctrl/Cmd + P` 打开 Quick Open：

- 搜索工作区文件名和路径
- 最近访问文件优先
- Markdown、图片、PDF、Excalidraw 等统一打开
- 显示当前文件与未保存状态
- 可执行保存、全文搜索、专注模式、侧边栏切换等常用命令

### 全文搜索

`Ctrl/Cmd + F` 打开跨文件搜索：

- 搜索当前工作区的文本内容
- 展示匹配上下文
- 点击结果直接进入对应文件
- Enter / 上下导航会真正切换搜索结果，而不只是更新计数

## Excalidraw

MarkFlow 集成 `@excalidraw/excalidraw`：

- 创建和编辑 `.excalidraw` 文件
- 跟随亮色/暗色主题
- 使用同一工作区文件树管理
- 支持 Excalidraw 自带的图片导出能力

## 常用快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl/Cmd + P` | Quick Open / Command Palette |
| `Ctrl/Cmd + F` | 跨文件搜索 |
| `Ctrl/Cmd + S` | 手动保存当前文件 |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | 重做 |
| `Ctrl/Cmd + /` | WYSIWYG / Source Mode 切换 |
| `Ctrl/Cmd + B` | 粗体 |
| `Ctrl/Cmd + I` | 斜体 |
| `Ctrl/Cmd + K` | 链接 |
| `/`（空行） | Slash Menu |
| `Enter` | 新段落 / 延续列表或引用 |
| `Shift+Enter` | 段落/列表/引用中的 hard line break |
| `Tab` | 缩进；Source Mode 支持多行缩进 |
| `Shift+Tab` | Source Mode 反向缩进 |
| `Esc` | 退出活动块；专注模式下退出专注模式 |

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

## 当前代码结构

```text
src/
├── app/
│   ├── page.tsx                    # 路由入口
│   ├── layout.tsx                  # 全局 runtime / metadata
│   ├── editor.css                  # 主编辑器视觉
│   └── editor-polish.css           # 交互细节与 Source Mode 样式
├── components/
│   ├── workspace/
│   │   └── WorkspacePage.tsx       # 应用壳层与编辑/预览布局
│   └── editor/
│       ├── TyporaEditor.tsx        # WYSIWYG / Source Mode 入口
│       ├── TyporaEditorCore.tsx    # 块级编辑与键盘/selection 控制
│       ├── markdown/
│       │   ├── markdown-blocks.ts  # Markdown 语义块解析
│       │   └── MarkdownRenderer.tsx
│       ├── QuickOpen.tsx
│       ├── PersistenceRuntime.tsx
│       ├── WikiLinkRenameRuntime.tsx
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
```

更完整的工程边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，详细功能行为见 [`FEATURES.md`](FEATURES.md)。

## 快速开始

### 环境要求

- Node.js 24（CI 当前使用版本）
- Chrome / Edge 等支持 File System Access API 的浏览器可获得完整本地工作区能力

### npm

```bash
npm install --legacy-peer-deps
npm run dev
```

验证：

```bash
npm run lint
npm run build
```

### Bun

```bash
bun install
bun run dev
bun run build
```

## 浏览器说明

MarkFlow 的核心编辑与渲染是 Web 应用，但“直接打开并写回本地文件夹”依赖 File System Access API。

- Chromium 系浏览器：完整体验。
- Safari / Firefox：部分 File System Access 能力不可用或行为不同。

如果未来提供桌面版，计划继续复用同一套 React/Markdown 编辑层，只替换工作区文件系统适配器，而不是维护第二套编辑器。

## 当前工程方向

近期重点不是继续堆更多工具栏按钮，而是把已有能力做得更稳定、更接近真正的文档编辑器：

1. 更好的 WYSIWYG / Source Mode 光标与滚动位置映射：从当前滚动比例进一步升级到 source-position-aware mapping。
2. 外部文件变化检测与 Workspace Refresh，且不能覆盖 MarkFlow 内尚未保存的 dirty 内容。
3. 进一步统一文件 CRUD 的 typed result/error API，让底层 action 直接返回结果而不是由 UI 观察后置状态。
4. 为路径变换、Wiki Link、Markdown block parser、表格 source mapping、键盘行为和 autosave race 补自动测试。
5. 评估 inline Markdown syntax 按焦点显隐的编辑模型，而不破坏 Markdown 文件作为唯一真源的原则。
6. 稳定 Workspace Adapter 后再推进 Tauri 桌面打包。
7. 单独处理依赖/lockfile 与 React 19 / Excalidraw peer-range 兼容性债务。

## License

请以仓库中实际的 License 文件为准；如果尚未添加 License，则默认不授予额外开源许可。