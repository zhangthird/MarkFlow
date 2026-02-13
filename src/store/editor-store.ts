import { create } from 'zustand'
import { Language, translations, TranslationKey } from '@/lib/i18n'

export type FileType = 'markdown' | 'excalidraw' | 'image' | 'text' | 'pdf' | 'binary'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  fileType?: FileType // Only for files
  path: string
  children?: FileNode[]
  content?: string // For markdown files
  excalidrawData?: string // JSON string for Excalidraw files
  blobUrl?: string // For image/binary preview from File System Access API
  mimeType?: string
  handle?: FileSystemFileHandle // For saving to actual file system
  isModified?: boolean
}

// Helper to detect file type from extension
export function detectFileType(filename: string): FileType {
  const lowerName = filename.toLowerCase()

  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(lowerName)) {
    return 'image'
  }

  if (/\.pdf$/i.test(lowerName)) {
    return 'pdf'
  }

  if (filename.endsWith('.excalidraw') || filename.endsWith('.excalidraw.json')) {
    return 'excalidraw'
  }

  if (/\.(md|markdown)$/i.test(lowerName)) {
    return 'markdown'
  }

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

// History for undo/redo
interface HistoryState {
  past: string[]
  future: string[]
  maxHistory: number
}

interface EditorState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  
  // Language
  language: Language
  
  // Sidebar
  sidebarOpen: boolean
  sidebarWidth: number
  
  // Files
  files: FileNode[]
  currentFile: FileNode | null
  rootFolderName: string
  rootHandle: FileSystemDirectoryHandle | null
  
  // Editor
  content: string
  isEditing: boolean
  
  // UI
  showWordCount: boolean
  focusMode: boolean
  
  // Search
  search: SearchState
  
  // History for undo/redo
  history: HistoryState
  
  // Actions
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
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
  
  // Search actions
  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  searchInFiles: () => void
  nextSearchResult: () => void
  prevSearchResult: () => void
}

// Sample markdown content for demo
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
  isModified: false
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Theme
  theme: 'system',
  
  // Language
  language: 'zh',
  
  // Initial state
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
  
  // Search
  search: {
    isOpen: false,
    query: '',
    results: [],
    currentIndex: 0
  },
  
  // History for undo/redo
  history: {
    past: [],
    future: [],
    maxHistory: 50
  },
  
  // Theme actions
  setTheme: (theme) => {
    set({ theme })
    // Apply theme to document
    const root = document.documentElement
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemTheme === 'dark')
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
    localStorage.setItem('theme', theme)
  },
  
  // Translation function
  t: (key) => {
    const { language } = get()
    return translations[language][key]
  },
  
  // Language actions
  setLanguage: (language) => {
    set({ language })
    localStorage.setItem('language', language)
  },
  
  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  
  setFiles: (files) => set({ files }),
  
  setCurrentFile: (file) => set({ 
    currentFile: file,
    content: file?.content || '',
    // Note: Excalidraw data is stored in file.excalidrawData
  }),
  
  setRootFolderName: (name) => set({ rootFolderName: name }),
  
  setRootHandle: (handle) => set({ rootHandle: handle }),
  
  setContent: (content) => {
    const { history } = get()
    // Add current content to history
    set({
      content,
      history: {
        ...history,
        past: [...history.past, get().content].slice(-history.maxHistory),
        future: [] // Clear future on new change
      }
    })
  },
  
  updateCurrentFileContent: (content) => {
    const { currentFile, files, history } = get()
    if (!currentFile) return
    
    const updatedFile = { ...currentFile, content, isModified: true }
    
    const updateFileContent = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === currentFile.path) {
          return { ...node, content, isModified: true }
        }
        if (node.children) {
          return { ...node, children: updateFileContent(node.children) }
        }
        return node
      })
    }
    
    // Get current content before update
    const currentContent = get().content
    
    set({
      content,
      currentFile: updatedFile,
      files: updateFileContent(files),
      history: {
        ...history,
        past: [...history.past, currentContent].slice(-history.maxHistory),
        future: [] // Clear future on new change
      }
    })
  },
  
  updateExcalidrawData: (data) => {
    const { currentFile, files } = get()
    if (!currentFile) return
    
    const updatedFile = { ...currentFile, excalidrawData: data, isModified: true }
    
    const updateFileData = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === currentFile.path) {
          return { ...node, excalidrawData: data, isModified: true }
        }
        if (node.children) {
          return { ...node, children: updateFileData(node.children) }
        }
        return node
      })
    }
    
    set({
      currentFile: updatedFile,
      files: updateFileData(files)
    })
  },
  
  toggleFocusMode: () => set((state) => ({ 
    focusMode: !state.focusMode,
    sidebarOpen: state.focusMode ? true : false
  })),
  
  addFile: (parentPath, name, type) => {
    const { files, rootHandle } = get()
    const fileType = detectFileType(name)
    
    // Default Excalidraw data
    const defaultExcalidrawData = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'MarkFlow',
      elements: [],
      appState: {
        viewBackgroundColor: '#ffffff',
        currentItemFontFamily: 1
      },
      files: {}
    })
    
    const newFile: FileNode = {
      id: Date.now().toString(),
      name,
      type,
      fileType: type === 'file' ? fileType : undefined,
      path: parentPath === '/' ? `/${name}` : `${parentPath}/${name}`,
      content: type === 'file' && (fileType === 'markdown' || fileType === 'text') ? `# ${name.replace(/\.md$/, '')}\n\n` : undefined,
      excalidrawData: type === 'file' && fileType === 'excalidraw' ? defaultExcalidrawData : undefined,
      children: type === 'folder' ? [] : undefined,
      isModified: false
    }
    
    const addToTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === parentPath && node.type === 'folder') {
          return { ...node, children: [...(node.children || []), newFile] }
        }
        if (node.children) {
          return { ...node, children: addToTree(node.children) }
        }
        return node
      })
    }
    
    if (parentPath === '/') {
      set({ files: [...files, newFile] })
    } else {
      set({ files: addToTree(files) })
    }
    
    // Create file in file system if handle exists
    if (rootHandle && type === 'file') {
      rootHandle.getFileHandle(name, { create: true }).catch(console.error)
    }
  },
  
  deleteFile: (path) => {
    const { files, currentFile } = get()
    
    const deleteFromTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.filter(node => {
        if (node.path === path) return false
        if (node.children) {
          return { ...node, children: deleteFromTree(node.children) }
        }
        return true
      })
    }
    
    const newFiles = files.filter(node => node.path !== path).map(node => {
      if (node.children) {
        return { ...node, children: deleteFromTree(node.children) }
      }
      return node
    })
    
    set({ 
      files: newFiles,
      currentFile: currentFile?.path === path ? null : currentFile
    })
  },
  
  renameFile: (path, newName) => {
    const { files, currentFile } = get()
    
    // Helper to update paths of children when parent folder is renamed
    const updateChildPaths = (children: FileNode[], oldParentPath: string, newParentPath: string): FileNode[] => {
      return children.map(child => {
        const newChildPath = child.path.replace(oldParentPath, newParentPath)
        return {
          ...child,
          path: newChildPath,
          children: child.children 
            ? updateChildPaths(child.children, oldParentPath, newParentPath) 
            : undefined
        }
      })
    }
    
    const renameInTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          const parentPath = path.substring(0, path.lastIndexOf('/'))
          const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`
          const renamedNode = { ...node, name: newName, path: newPath }
          
          // If it's a folder, update all children paths
          if (node.children && node.children.length > 0) {
            renamedNode.children = updateChildPaths(node.children, path, newPath)
          }
          
          return renamedNode
        }
        if (node.children) {
          return { ...node, children: renameInTree(node.children) }
        }
        return node
      })
    }
    
    const updatedFiles = renameInTree([...files])
    const updatedCurrentFile = currentFile?.path === path 
      ? { ...currentFile, name: newName }
      : currentFile
    
    set({ files: updatedFiles, currentFile: updatedCurrentFile })
  },
  
  saveCurrentFile: async () => {
    const { currentFile, content, files } = get()
    if (!currentFile) return false
    
    // Determine content to save based on file type
    const dataToSave = currentFile.fileType === 'excalidraw' 
      ? currentFile.excalidrawData || '{}' 
      : content
    
    // If we have a file handle, save to actual file
    if (currentFile.handle) {
      try {
        const writable = await currentFile.handle.createWritable()
        await writable.write(dataToSave)
        await writable.close()
        
        // Mark as not modified
        const updatedFile = { ...currentFile, isModified: false }
        const updateModified = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === currentFile.path) {
              return { ...node, isModified: false }
            }
            if (node.children) {
              return { ...node, children: updateModified(node.children) }
            }
            return node
          })
        }
        
        set({
          currentFile: updatedFile,
          files: updateModified(files)
        })
        
        return true
      } catch (err) {
        console.error('Failed to save file:', err)
        return false
      }
    }
    
    // No file handle - content is stored in memory only
    // Mark as saved in memory
    const updatedFile = { ...currentFile, isModified: false }
    set({ currentFile: updatedFile })
    return true
  },
  
  markFileModified: (path, modified) => {
    const { files, currentFile } = get()
    
    const markInTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          return { ...node, isModified: modified }
        }
        if (node.children) {
          return { ...node, children: markInTree(node.children) }
        }
        return node
      })
    }
    
    set({
      files: markInTree(files),
      currentFile: currentFile?.path === path 
        ? { ...currentFile, isModified: modified }
        : currentFile
    })
  },
  
  // Search actions
  openSearch: () => set((state) => ({ 
    search: { ...state.search, isOpen: true, query: '', results: [], currentIndex: 0 }
  })),
  
  closeSearch: () => set((state) => ({ 
    search: { ...state.search, isOpen: false }
  })),
  
  setSearchQuery: (query) => set((state) => ({ 
    search: { ...state.search, query }
  })),
  
  searchInFiles: () => {
    const { files, search } = get()
    if (!search.query.trim()) {
      set({ search: { ...search, results: [], currentIndex: 0 } })
      return
    }
    
    const results: { path: string; line: number; content: string }[] = []
    const query = search.query.toLowerCase()
    
    const searchInNode = (node: FileNode) => {
      if (node.type === 'file' && node.content) {
        const lines = node.content.split('\n')
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(query)) {
            results.push({
              path: node.path,
              line: index + 1,
              content: line.trim()
            })
          }
        })
      }
      if (node.children) {
        node.children.forEach(searchInNode)
      }
    }
    
    files.forEach(searchInNode)
    
    set({ search: { ...search, results, currentIndex: 0 } })
  },
  
  nextSearchResult: () => set((state) => {
    const { search } = state
    if (search.results.length === 0) return state
    const nextIndex = (search.currentIndex + 1) % search.results.length
    return { search: { ...search, currentIndex: nextIndex } }
  }),
  
  prevSearchResult: () => set((state) => {
    const { search } = state
    if (search.results.length === 0) return state
    const prevIndex = search.currentIndex === 0 ? search.results.length - 1 : search.currentIndex - 1
    return { search: { ...search, currentIndex: prevIndex } }
  }),
  
  // Undo/Redo actions
  undo: () => {
    const { history, content } = get()
    if (history.past.length === 0) return
    
    const previous = history.past[history.past.length - 1]
    const newPast = history.past.slice(0, -1)
    
    set({
      content: previous,
      history: {
        ...history,
        past: newPast,
        future: [content, ...history.future]
      }
    })
  },
  
  redo: () => {
    const { history, content } = get()
    if (history.future.length === 0) return
    
    const next = history.future[0]
    const newFuture = history.future.slice(1)
    
    set({
      content: next,
      history: {
        ...history,
        past: [...history.past, content],
        future: newFuture
      }
    })
  },
  
  canUndo: () => get().history.past.length > 0,
  
  canRedo: () => get().history.future.length > 0,
  
  clearHistory: () => set({
    history: {
      past: [],
      future: [],
      maxHistory: 50
    }
  })
}))

// Initialize theme from localStorage
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
  if (savedTheme) {
    useEditorStore.getState().setTheme(savedTheme)
  }
}
