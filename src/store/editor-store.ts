import { create } from 'zustand'
import { Language, translations, TranslationKey } from '@/lib/i18n'
import {
  createEntryOnDisk,
  getDirectoryHandleAtPath,
  isValidEntryName,
  parentPathOf,
  removeEntryOnDisk,
  renameEntryOnDisk,
} from '@/lib/file-system'

export type FileType = 'markdown' | 'excalidraw' | 'image' | 'text' | 'pdf' | 'binary'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  fileType?: FileType
  path: string
  children?: FileNode[]
  content?: string
  excalidrawData?: string
  blobUrl?: string
  mimeType?: string
  handle?: FileSystemFileHandle
  isModified?: boolean
}

export function detectFileType(filename: string): FileType {
  const lowerName = filename.toLowerCase()

  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(lowerName)) return 'image'
  if (/\.pdf$/i.test(lowerName)) return 'pdf'
  if (lowerName.endsWith('.excalidraw') || lowerName.endsWith('.excalidraw.json')) return 'excalidraw'
  if (/\.(md|markdown)$/i.test(lowerName)) return 'markdown'
  if (/\.(txt|json|yml|yaml|xml|html?|css|scss|less|js|jsx|ts|tsx|py|java|go|rs|c|cpp|h|hpp|sh|sql|toml|ini|conf)$/i.test(lowerName)) {
    return 'text'
  }

  return 'binary'
}

interface SearchState {
  isOpen: boolean
  query: string
  results: { path: string; line: number; content: string }[]
  currentIndex: number
}

interface HistoryState {
  filePath: string | null
  past: string[]
  future: string[]
  maxHistory: number
}

interface EditorState {
  theme: 'light' | 'dark' | 'system'
  language: Language
  sidebarOpen: boolean
  sidebarWidth: number
  files: FileNode[]
  currentFile: FileNode | null
  rootFolderName: string
  rootHandle: FileSystemDirectoryHandle | null
  content: string
  isEditing: boolean
  showWordCount: boolean
  focusMode: boolean
  search: SearchState
  history: HistoryState

  t: (key: TranslationKey) => string
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setLanguage: (language: Language) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setFiles: (files: FileNode[]) => void
  setCurrentFile: (file: FileNode | null) => void
  setRootFolderName: (name: string) => void
  setRootHandle: (handle: FileSystemDirectoryHandle | null) => void
  setContent: (content: string) => void
  updateCurrentFileContent: (content: string) => void
  updateExcalidrawData: (data: string) => void
  toggleFocusMode: () => void
  addFile: (parentPath: string, name: string, type: 'file' | 'folder') => void
  deleteFile: (path: string) => void
  renameFile: (path: string, newName: string) => void
  saveCurrentFile: () => Promise<boolean>
  markFileModified: (path: string, modified: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  searchInFiles: () => void
  nextSearchResult: () => void
  prevSearchResult: () => void
}

const sampleContent = `# Welcome to MarkFlow

这是一个 **WYSIWYG** Markdown 编辑器，支持实时渲染。

## 功能特性

- **实时渲染**：编辑时即可看到格式化效果
- **数学公式**：支持 LaTeX 公式
- **简洁界面**：极简设计，专注写作

## 数学公式示例

行内公式：$E = mc^2$

块级公式：

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

## 代码块

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

## 列表

1. 第一项
2. 第二项
3. 第三项

- 无序列表
- 另一项
  - 嵌套项

## 引用

> 预测未来的最好方式就是创造它。

## 表格

| 功能 | 状态 |
|------|------|
| WYSIWYG | ✅ |
| 数学公式 | ✅ |
| PDF 导出 | ✅ |
| Dark Mode | ✅ |
| 查找功能 | ✅ |

---

*开始编辑体验吧！*
`

const defaultFile: FileNode = {
  id: '1',
  name: 'Welcome.md',
  type: 'file',
  fileType: 'markdown',
  path: '/Welcome.md',
  content: sampleContent,
  isModified: false,
}

const emptyHistory = (filePath: string | null = null): HistoryState => ({
  filePath,
  past: [],
  future: [],
  maxHistory: 50,
})

function updateNodeByPath(
  nodes: FileNode[],
  path: string,
  updater: (node: FileNode) => FileNode
): FileNode[] {
  return nodes.map(node => {
    if (node.path === path) return updater(node)
    if (!node.children) return node
    return { ...node, children: updateNodeByPath(node.children, path, updater) }
  })
}

function removeNodeByPath(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter(node => node.path !== path)
    .map(node => node.children
      ? { ...node, children: removeNodeByPath(node.children, path) }
      : node)
}

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const match = findNodeByPath(node.children, path)
      if (match) return match
    }
  }
  return null
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  return path === oldPrefix ? newPrefix : `${newPrefix}${path.slice(oldPrefix.length)}`
}

function renameNodeTree(node: FileNode, oldPath: string, newPath: string, newName: string): FileNode {
  const renamedPath = replacePathPrefix(node.path, oldPath, newPath)
  return {
    ...node,
    id: renamedPath,
    name: node.path === oldPath ? newName : node.name,
    path: renamedPath,
    fileType: node.path === oldPath && node.type === 'file' ? detectFileType(newName) : node.fileType,
    children: node.children?.map(child => renameNodeTree(child, oldPath, newPath, newName)),
  }
}

async function rebindFileHandles(
  rootHandle: FileSystemDirectoryHandle,
  node: FileNode
): Promise<FileNode> {
  if (node.type === 'file') {
    const parent = await getDirectoryHandleAtPath(rootHandle, parentPathOf(node.path))
    const handle = await parent.getFileHandle(node.name)
    return { ...node, handle }
  }

  const children = node.children
    ? await Promise.all(node.children.map(child => rebindFileHandles(rootHandle, child)))
    : []
  return { ...node, children }
}

function initialContentFor(name: string, fileType: FileType): string | undefined {
  if (fileType === 'markdown') return `# ${name.replace(/\.(md|markdown)$/i, '')}\n\n`
  if (fileType === 'text') return ''
  return undefined
}

function initialExcalidrawData(): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'MarkFlow',
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
    },
    files: {},
  })
}

export const useEditorStore = create<EditorState>((set, get) => ({
  theme: 'system',
  language: 'zh',
  sidebarOpen: true,
  sidebarWidth: 260,
  files: [defaultFile],
  currentFile: defaultFile,
  rootFolderName: 'Documents',
  rootHandle: null,
  content: sampleContent,
  isEditing: false,
  showWordCount: true,
  focusMode: false,
  search: {
    isOpen: false,
    query: '',
    results: [],
    currentIndex: 0,
  },
  history: emptyHistory(defaultFile.path),

  setTheme: (theme) => {
    set({ theme })
    const root = document.documentElement
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemTheme === 'dark')
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
    localStorage.setItem('theme', theme)
  },

  t: (key) => translations[get().language][key],

  setLanguage: (language) => {
    set({ language })
    localStorage.setItem('language', language)
  },

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setFiles: (files) => set({ files }),
  setRootFolderName: (name) => set({ rootFolderName: name }),
  setRootHandle: (handle) => set({ rootHandle: handle }),

  setCurrentFile: (file) => {
    const previousPath = get().currentFile?.path ?? null
    const nextPath = file?.path ?? null
    set({
      currentFile: file,
      content: file?.content || '',
      history: previousPath === nextPath ? get().history : emptyHistory(nextPath),
    })
  },

  setContent: (content) => {
    const state = get()
    const filePath = state.currentFile?.path ?? null
    const history = state.history.filePath === filePath ? state.history : emptyHistory(filePath)
    set({
      content,
      history: {
        ...history,
        past: [...history.past, state.content].slice(-history.maxHistory),
        future: [],
      },
    })
  },

  updateCurrentFileContent: (content) => {
    const state = get()
    if (!state.currentFile) return

    const filePath = state.currentFile.path
    const history = state.history.filePath === filePath ? state.history : emptyHistory(filePath)
    const updatedCurrentFile = { ...state.currentFile, content, isModified: true }

    set({
      content,
      currentFile: updatedCurrentFile,
      files: updateNodeByPath(state.files, filePath, node => ({ ...node, content, isModified: true })),
      history: {
        ...history,
        past: [...history.past, state.content].slice(-history.maxHistory),
        future: [],
      },
    })
  },

  updateExcalidrawData: (data) => {
    const state = get()
    if (!state.currentFile) return
    const filePath = state.currentFile.path
    set({
      currentFile: { ...state.currentFile, excalidrawData: data, isModified: true },
      files: updateNodeByPath(state.files, filePath, node => ({
        ...node,
        excalidrawData: data,
        isModified: true,
      })),
    })
  },

  toggleFocusMode: () => set(state => ({
    focusMode: !state.focusMode,
    sidebarOpen: state.focusMode,
  })),

  addFile: (parentPath, rawName, type) => {
    const name = rawName.trim()
    if (!isValidEntryName(name)) {
      console.error('Invalid file or folder name:', rawName)
      return
    }

    const performAdd = async () => {
      const state = get()
      const fileType = type === 'file' ? detectFileType(name) : undefined
      const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`
      if (findNodeByPath(state.files, path)) {
        console.error(`An entry already exists at ${path}`)
        return
      }

      const content = type === 'file' && fileType ? initialContentFor(name, fileType) : undefined
      const excalidrawData = type === 'file' && fileType === 'excalidraw' ? initialExcalidrawData() : undefined
      let handle: FileSystemFileHandle | undefined

      try {
        if (state.rootHandle) {
          const created = await createEntryOnDisk(
            state.rootHandle,
            parentPath,
            name,
            type,
            excalidrawData ?? content ?? ''
          )
          handle = created ?? undefined
        }
      } catch (error) {
        console.error('Failed to create entry on disk:', error)
        return
      }

      const newNode: FileNode = {
        id: path,
        name,
        type,
        fileType,
        path,
        content,
        excalidrawData,
        children: type === 'folder' ? [] : undefined,
        handle,
        isModified: false,
      }

      const latest = get()
      const files = parentPath === '/'
        ? [...latest.files, newNode]
        : updateNodeByPath(latest.files, parentPath, node => ({
            ...node,
            children: [...(node.children || []), newNode],
          }))

      if (type === 'file') {
        set({
          files,
          currentFile: newNode,
          content: newNode.content || '',
          history: emptyHistory(newNode.path),
        })
      } else {
        set({ files })
      }
    }

    void performAdd()
  },

  deleteFile: (path) => {
    const performDelete = async () => {
      const state = get()
      const target = findNodeByPath(state.files, path)
      if (!target) return

      try {
        if (state.rootHandle) {
          await removeEntryOnDisk(state.rootHandle, path, target.type)
        }
      } catch (error) {
        console.error('Failed to delete entry on disk:', error)
        return
      }

      const latest = get()
      const removesCurrent = latest.currentFile
        ? latest.currentFile.path === path || latest.currentFile.path.startsWith(`${path}/`)
        : false

      set({
        files: removeNodeByPath(latest.files, path),
        currentFile: removesCurrent ? null : latest.currentFile,
        content: removesCurrent ? '' : latest.content,
        history: removesCurrent ? emptyHistory(null) : latest.history,
      })
    }

    void performDelete()
  },

  renameFile: (path, rawNewName) => {
    const newName = rawNewName.trim()
    if (!isValidEntryName(newName)) {
      console.error('Invalid file or folder name:', rawNewName)
      return
    }

    const performRename = async () => {
      const state = get()
      const target = findNodeByPath(state.files, path)
      if (!target || target.name === newName) return

      const parentPath = parentPathOf(path)
      const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`
      if (findNodeByPath(state.files, newPath)) {
        console.error(`An entry already exists at ${newPath}`)
        return
      }

      let renamedRoot = renameNodeTree(target, path, newPath, newName)

      try {
        if (state.rootHandle) {
          const newFileHandle = await renameEntryOnDisk(state.rootHandle, path, newName, target.type)
          renamedRoot = target.type === 'file'
            ? { ...renamedRoot, handle: newFileHandle ?? undefined }
            : await rebindFileHandles(state.rootHandle, renamedRoot)
        }
      } catch (error) {
        console.error('Failed to rename entry on disk:', error)
        return
      }

      const replaceRenamedNode = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
        if (node.path === path) return renamedRoot
        if (node.children) return { ...node, children: replaceRenamedNode(node.children) }
        return node
      })

      const latest = get()
      const currentPath = latest.currentFile?.path
      const currentInsideTarget = currentPath === path || Boolean(currentPath?.startsWith(`${path}/`))
      const nextCurrentPath = currentInsideTarget && currentPath
        ? replacePathPrefix(currentPath, path, newPath)
        : currentPath
      const files = replaceRenamedNode(latest.files)
      const currentFile = nextCurrentPath ? findNodeByPath(files, nextCurrentPath) : latest.currentFile

      set({
        files,
        currentFile,
        content: currentFile?.content ?? latest.content,
        history: currentInsideTarget ? emptyHistory(nextCurrentPath ?? null) : latest.history,
      })
    }

    void performRename()
  },

  saveCurrentFile: async () => {
    const state = get()
    if (!state.currentFile) return false

    const dataToSave = state.currentFile.fileType === 'excalidraw'
      ? state.currentFile.excalidrawData || '{}'
      : state.content

    if (state.currentFile.handle) {
      try {
        const writable = await state.currentFile.handle.createWritable()
        await writable.write(dataToSave)
        await writable.close()
      } catch (error) {
        console.error('Failed to save file:', error)
        return false
      }
    }

    const latest = get()
    const currentPath = latest.currentFile?.path
    if (!currentPath) return false
    const currentFile = { ...latest.currentFile, isModified: false }

    set({
      currentFile,
      files: updateNodeByPath(latest.files, currentPath, node => ({ ...node, isModified: false })),
    })
    return true
  },

  markFileModified: (path, modified) => {
    const state = get()
    set({
      files: updateNodeByPath(state.files, path, node => ({ ...node, isModified: modified })),
      currentFile: state.currentFile?.path === path
        ? { ...state.currentFile, isModified: modified }
        : state.currentFile,
    })
  },

  openSearch: () => set(state => ({
    search: { ...state.search, isOpen: true, query: '', results: [], currentIndex: 0 },
  })),

  closeSearch: () => set(state => ({
    search: { ...state.search, isOpen: false },
  })),

  setSearchQuery: (query) => set(state => ({
    search: { ...state.search, query },
  })),

  searchInFiles: () => {
    const state = get()
    const query = state.search.query.trim().toLowerCase()
    if (!query) {
      set({ search: { ...state.search, results: [], currentIndex: 0 } })
      return
    }

    const results: SearchState['results'] = []
    const visit = (node: FileNode) => {
      if (node.type === 'file' && node.content) {
        node.content.split('\n').forEach((line, index) => {
          if (line.toLowerCase().includes(query)) {
            results.push({ path: node.path, line: index + 1, content: line.trim() })
          }
        })
      }
      node.children?.forEach(visit)
    }
    state.files.forEach(visit)

    set({ search: { ...state.search, results, currentIndex: 0 } })
  },

  nextSearchResult: () => set(state => {
    if (state.search.results.length === 0) return state
    return {
      search: {
        ...state.search,
        currentIndex: (state.search.currentIndex + 1) % state.search.results.length,
      },
    }
  }),

  prevSearchResult: () => set(state => {
    if (state.search.results.length === 0) return state
    return {
      search: {
        ...state.search,
        currentIndex: state.search.currentIndex === 0
          ? state.search.results.length - 1
          : state.search.currentIndex - 1,
      },
    }
  }),

  undo: () => {
    const state = get()
    const currentPath = state.currentFile?.path
    if (!currentPath || state.history.filePath !== currentPath || state.history.past.length === 0) return

    const previous = state.history.past[state.history.past.length - 1]
    const history = {
      ...state.history,
      past: state.history.past.slice(0, -1),
      future: [state.content, ...state.history.future],
    }

    set({
      content: previous,
      currentFile: { ...state.currentFile, content: previous, isModified: true },
      files: updateNodeByPath(state.files, currentPath, node => ({ ...node, content: previous, isModified: true })),
      history,
    })
  },

  redo: () => {
    const state = get()
    const currentPath = state.currentFile?.path
    if (!currentPath || state.history.filePath !== currentPath || state.history.future.length === 0) return

    const next = state.history.future[0]
    const history = {
      ...state.history,
      past: [...state.history.past, state.content].slice(-state.history.maxHistory),
      future: state.history.future.slice(1),
    }

    set({
      content: next,
      currentFile: { ...state.currentFile, content: next, isModified: true },
      files: updateNodeByPath(state.files, currentPath, node => ({ ...node, content: next, isModified: true })),
      history,
    })
  },

  canUndo: () => {
    const state = get()
    return Boolean(state.currentFile) && state.history.filePath === state.currentFile?.path && state.history.past.length > 0
  },

  canRedo: () => {
    const state = get()
    return Boolean(state.currentFile) && state.history.filePath === state.currentFile?.path && state.history.future.length > 0
  },

  clearHistory: () => set({ history: emptyHistory(get().currentFile?.path ?? null) }),
}))

if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
  if (savedTheme) useEditorStore.getState().setTheme(savedTheme)
}
