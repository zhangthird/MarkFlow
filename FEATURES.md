# MarkFlow 功能文档

本文档详细说明 MarkFlow 编辑器的所有功能特性、使用方法和技术实现。

## 目录

- [核心编辑功能](#核心编辑功能)
- [Excalidraw 绘图](#excalidraw-绘图)
- [Markdown 支持](#markdown-支持)
- [文件管理](#文件管理)
- [高级功能](#高级功能)
- [响应式支持](#响应式支持)

---

## 核心编辑功能

### WYSIWYG 所见即所得

MarkFlow 提供真正的所见即所得编辑体验：

**工作原理**：
1. 内容以渲染后的形式显示（标题、列表、表格等）
2. 点击任意块进入编辑模式，显示原始 Markdown
3. 退出编辑（按 Esc 或点击外部）立即重新渲染

**支持的块类型**：
- 标题（H1-H6）
- 段落
- 列表（有序、无序、待办）
- 代码块（带语法高亮）
- 数学公式（LaTeX）
- 表格
- 引用块
- 分割线
- Mermaid 图表

### Slash 命令系统

快速插入功能，提高编辑效率。

**触发条件**：
- 在**新行**的**开头**输入 `/`
- 当前必须在编辑模式中

**可用命令**：

#### 基础格式
- `/h1`, `/h2`, `/h3` - 插入标题
- `/bullet` - 无序列表
- `/numbered` - 有序列表
- `/todo` - 待办事项列表
- `/quote` - 引用块
- `/divider` - 分割线

#### 内容块
- `/code` - 代码块模板
- `/math` - LaTeX 数学公式块
- `/table` - 表格模板
- `/mermaid` - Mermaid 流程图模板

#### 媒体
- `/link` - 插入链接
- `/image` - 插入图片
- `/wikilink` - Wiki 风格链接 `[[文件名]]`

**使用技巧**：
- 输入 `/` 后可以继续输入关键词过滤命令
- 使用 `↑` `↓` 方向键选择
- `Enter` 确认选择
- `Esc` 关闭菜单

---

## Excalidraw 绘图

### 功能概述

集成完整的 Excalidraw 绘图功能，支持手绘风格的图表和示意图。

**创建 Excalidraw 文件**：
1. 点击侧边栏"新建"按钮
2. 选择 "Excalidraw"
3. 输入文件名（自动添加 `.excalidraw` 扩展名）

### 支持的功能

- ✅ **绘图工具**：矩形、圆形、箭头、线条、自由绘制、文本
- ✅ **导出**：PNG、SVG 格式导出
- ✅ **主题**：自动跟随编辑器明暗主题
- ✅ **撤销/重做**：完整的历史记录
- ✅ **自动保存**：实时保存到本地存储

### 菜单选项

**Export, preferences, and more...** 菜单包含：
- **Open** - 打开 Excalidraw 文件
- **Save to...** - 另存为
- **Export image...** - 导出为图片（PNG/SVG/Clipboard）
- **Reset the canvas** - 清空画布
- **Canvas background** - 更改画布背景颜色

### 技术实现

- 使用 `@excalidraw/excalidraw` v0.18.0
- React 19 兼容
- 动态加载，避免 SSR 问题
- 错误边界保护

---

## Markdown 支持

### 标准 Markdown

完全支持 GitHub Flavored Markdown (GFM)：

```markdown
# 标题 1
## 标题 2
### 标题 3

**粗体** *斜体* ~~删除线~~

- 无序列表
  - 嵌套项

1. 有序列表
2. 第二项

- [ ] 待办事项
- [x] 已完成

> 引用块

`行内代码`

​```javascript
代码块
​```

[链接](https://example.com)
![图片](image.png)

| 表头1 | 表头2 |
|-------|-------|
| 单元格 | 单元格 |
```

### 数学公式

使用 KaTeX 渲染 LaTeX 公式：

**行内公式**：
```markdown
$E = mc^2$
```

**块级公式**：
```markdown
$$
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

### Mermaid 图表

支持多种 Mermaid 图表类型：

**流程图**：
```markdown
​```mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
​```
```

**时序图**：
```markdown
​```mermaid
sequenceDiagram
    用户->>服务器: 请求
    服务器-->>用户: 响应
​```
```

**甘特图**：
```markdown
​```mermaid
gantt
    title 项目进度
    section 阶段1
    任务1 :a1, 2024-01-01, 7d
​```
```

### 双向链接

类似 Obsidian 的 Wiki 链接功能：

**创建链接**：
```markdown
参见 [[项目计划.md]] 了解更多
```

**功能特点**：
- 自动检测链接目标文件是否存在
- 点击跳转到目标文件
- 右侧面板显示反向链接（哪些文件链接到当前文件）

---

## 文件管理

### 文件系统集成

**打开文件夹**：
1. 点击工具栏"打开文件夹"图标
2. 选择本地文件夹
3. 授权浏览器访问（仅支持 Chrome/Edge）

**支持的操作**：
- ✅ 浏览目录树
- ✅ 创建新文件/文件夹
- ✅ 重命名
- ✅ 删除
- ✅ 保存到磁盘

### 文件类型

| 类型 | 扩展名 | 功能 |
|------|--------|------|
| Markdown | `.md` | 完整编辑支持 |
| 纯文本 | `.txt` | 文本编辑 |
| Excalidraw | `.excalidraw` | 绘图编辑 |
| 图片 | `.png`, `.jpg`, `.gif`, `.svg` | 预览 |
| PDF | `.pdf` | 内嵌预览 |
| 其他 | - | 文件管理 |

### 自动保存

**保存机制**：
1. 编辑后文件名显示橙色圆点（未保存标记）
2. 按 `Ctrl+S` / `Cmd+S` 手动保存
3. Excalidraw 自动保存（300ms 防抖）

**持久化**：
- 打开文件夹后，更改保存到实际磁盘
- 未打开文件夹时，数据保存在浏览器存储
- 刷新页面自动恢复上次打开的文件夹（需浏览器授权）

---

## 高级功能

### 撤销与重做

- **撤销**：`Ctrl+Z` / `Cmd+Z`
- **重做**：`Ctrl+Shift+Z` / `Ctrl+Y` / `Cmd+Shift+Z`
- 支持多级历史记录

### 查找功能

- **快捷键**：`Ctrl+F` / `Cmd+F`
- **跨文件搜索**：搜索所有打开的文件
- **高亮匹配**：搜索结果高亮显示
- **快速跳转**：点击结果跳转到对应位置

### 主题切换

- **Dark Mode**：点击工具栏太阳/月亮图标
- **系统主题**：自动跟随系统设置
- **持久化**：主题选择保存到本地存储
- **Excalidraw 同步**：绘图编辑器自动跟随主题

### 专注模式

- **激活**：点击工具栏专注模式按钮
- **效果**：隐藏侧边栏和工具栏
- **退出**：按 `Esc` 键

### PDF 导出

- 点击工具栏"打印/导出"图标
- 浏览器打印对话框选择"另存为 PDF"
- 保留所有格式（包括数学公式和图表）

### 多语言支持

- **中文/英文**：点击工具栏语言图标切换
- **自动检测**：首次访问根据浏览器语言设置
- **持久化**：语言选择保存到本地存储

---

## 响应式支持

### 设备适配

MarkFlow 在不同设备上提供优化体验：

**桌面端（>= 1024px）**：
- 完整侧边栏
- 所有工具栏按钮
- 双面板布局（编辑器 + 反向链接）

**平板电脑（768px - 1023px）**：
- 可折叠侧边栏
- 精简工具栏
- 优化触摸交互

**移动端（< 768px）**：
- 汉堡菜单侧边栏
- 最小化工具栏
- 单面板布局
- 触摸优化的编辑体验

### 技术实现

**Viewport 配置**：
```javascript
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}
```

**响应式样式**：
- Tailwind CSS 断点系统
- 媒体查询：`sm:`, `md:`, `lg:`, `xl:`
- 流式布局和弹性盒子

### 浏览器支持

| 浏览器 | 版本 | 支持级别 |
|--------|------|---------|
| Chrome | >= 90 | ✅ 完整支持 |
| Edge | >= 90 | ✅ 完整支持 |
| Safari | >= 14 | ⚠️ 部分支持* |
| Firefox | >= 88 | ⚠️ 部分支持* |

*不支持 File System Access API（无法打开本地文件夹）

---

## 键盘快捷键

### 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + S` | 保存文件 |
| `Ctrl/Cmd + F` | 打开搜索 |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` | 重做 |
| `Ctrl/Cmd + Y` | 重做 |
| `Esc` | 退出编辑/专注模式 |

### 编辑器快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 创建新块 |
| `Backspace` | 删除空块 |
| `Tab` | 插入缩进 |
| `↑` | 移动到上一块（光标在行首时） |
| `↓` | 移动到下一块（光标在行尾时） |
| `/` | 打开命令菜单（空行开头） |

### Excalidraw 快捷键

| 快捷键 | 功能 |
|--------|------|
| `V` | 选择工具 |
| `R` | 矩形 |
| `D` | 菱形 |
| `O` | 椭圆 |
| `A` | 箭头 |
| `L` | 线条 |
| `P` | 绘制 |
| `T` | 文本 |
| `E` | 橡皮擦 |
| `Ctrl/Cmd + D` | 复制 |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` | 重做 |

---

## 开发信息

### 技术栈

- **框架**：Next.js 16 (App Router)
- **语言**：TypeScript 5
- **UI**：Tailwind CSS 4 + shadcn/ui
- **Markdown**：react-markdown + remark-gfm
- **数学**：KaTeX (rehype-katex)
- **代码高亮**：react-syntax-highlighter
- **绘图**：@excalidraw/excalidraw v0.18.0
- **状态**：Zustand
- **图标**：Lucide React

### 项目结构

```
src/
├── app/
│   ├── page.tsx          # 主页面
│   ├── layout.tsx        # 布局和元数据
│   └── globals.css       # 全局样式
├── components/
│   ├── editor/
│   │   ├── TyporaEditor.tsx      # Markdown 编辑器
│   │   ├── ExcalidrawEditor.tsx  # Excalidraw 编辑器
│   │   ├── Sidebar.tsx           # 文件侧边栏
│   │   ├── Toolbar.tsx           # 工具栏
│   │   ├── SearchDialog.tsx      # 搜索对话框
│   │   ├── SlashMenu.tsx         # Slash 命令菜单
│   │   └── BacklinksPanel.tsx    # 反向链接面板
│   └── ui/                       # shadcn/ui 组件
├── store/
│   └── editor-store.ts           # Zustand 状态管理
├── lib/
│   └── i18n.ts                   # 国际化
└── hooks/                        # 自定义 Hooks
```

### API 参考

#### EditorStore (Zustand)

主要状态管理 store：

```typescript
interface EditorStore {
  // 文件相关
  files: FileNode[]
  currentFile: FileNode | null
  rootFolderName: string
  rootHandle: FileSystemDirectoryHandle | null
  
  // 编辑相关
  content: string
  past: string[]
  future: string[]
  
  // UI 相关
  sidebarOpen: boolean
  focusMode: boolean
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
  
  // 方法
  setFiles: (files: FileNode[]) => void
  setCurrentFile: (file: FileNode) => void
  updateCurrentFileContent: (content: string) => void
  undo: () => void
  redo: () => void
  // ... 更多方法
}
```

---

## 故障排除

### 常见问题

**Q: Excalidraw 菜单点击后出现错误**
A: 确保使用最新版本。旧版本可能存在兼容性问题。

**Q: Slash 命令菜单不出现**
A: 确保：
1. 在空行开头输入 `/`
2. 当前处于编辑模式
3. 光标位于行首

**Q: 无法保存到磁盘**
A: 检查：
1. 是否已打开文件夹
2. 浏览器是否支持（仅 Chrome/Edge）
3. 文件夹权限是否正确

**Q: 数学公式不渲染**
A: 确保：
1. 使用正确的 LaTeX 语法
2. 行内公式用单个 `$` 包裹
3. 块级公式用 `$$` 包裹并换行

**Q: Mermaid 图表不显示**
A: 检查：
1. 语法是否正确
2. 是否使用 ` ```mermaid ` 标记
3. 图表类型是否支持

### 性能优化

**编辑大文件时卡顿**：
- 使用 Excalidraw 处理复杂图表
- 分割大文档为多个小文件
- 减少实时渲染的内容块数量

**占用存储空间过大**：
- 定期清理浏览器存储
- 使用文件夹模式将数据保存到磁盘
- 压缩图片资源

---

## 更新日志

### v1.0.0 (最新)

**新功能**：
- ✅ WYSIWYG Markdown 编辑
- ✅ Excalidraw 绘图支持
- ✅ Slash 命令系统
- ✅ 双向链接
- ✅ Mermaid 图表
- ✅ 数学公式（KaTeX）
- ✅ 文件系统集成
- ✅ 响应式设计
- ✅ 多语言支持

**Bug 修复**：
- 🐛 修复 Excalidraw 菜单 React Error #130
- 🐛 添加移动端 viewport 支持
- 🐛 修复文件保存问题

**技术改进**：
- ⚡ 升级到 React 19
- ⚡ 升级到 Next.js 16
- ⚡ Excalidraw v0.18.0 兼容性

---

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

**开发环境设置**：
```bash
# 克隆仓库
git clone https://github.com/zhangthird/MarkFlow.git
cd MarkFlow

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

**代码规范**：
- 使用 TypeScript
- 遵循 ESLint 规则
- 编写清晰的注释
- 保持组件简洁

---

## 许可证

MIT License - 详见 LICENSE 文件
