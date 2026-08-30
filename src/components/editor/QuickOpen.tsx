'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  File,
  FileImage,
  FileText,
  Focus,
  PanelLeft,
  Pencil,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { FileNode, useEditorStore } from '@/store/editor-store'
import { refreshWorkspaceFromDisk } from '@/lib/workspace-refresh'

const RECENT_FILES_KEY = 'markflow-recent-files'
const MAX_RECENT_FILES = 8
const EMPTY_RECENT_PATHS: string[] = []

let recentPathCache: string[] | null = null
const recentPathListeners = new Set<() => void>()

function collectFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []

  const visit = (items: FileNode[]) => {
    for (const node of items) {
      if (node.type === 'file') result.push(node)
      if (node.children) visit(node.children)
    }
  }

  visit(nodes)
  return result
}

function readRecentPaths(): string[] {
  if (recentPathCache) return recentPathCache

  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    if (!raw) {
      recentPathCache = EMPTY_RECENT_PATHS
      return recentPathCache
    }

    const parsed = JSON.parse(raw)
    recentPathCache = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : EMPTY_RECENT_PATHS
    return recentPathCache
  } catch {
    recentPathCache = EMPTY_RECENT_PATHS
    return recentPathCache
  }
}

function subscribeRecentPaths(listener: () => void) {
  recentPathListeners.add(listener)
  return () => recentPathListeners.delete(listener)
}

function emitRecentPathChange() {
  recentPathListeners.forEach(listener => listener())
}

function recordRecentPath(path: string) {
  const current = readRecentPaths()
  const next = [path, ...current.filter(item => item !== path)].slice(0, MAX_RECENT_FILES)

  if (next.length === current.length && next.every((item, index) => item === current[index])) return

  recentPathCache = next
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next))
  emitRecentPathChange()
}

function useRecentPaths() {
  return useSyncExternalStore(
    subscribeRecentPaths,
    readRecentPaths,
    () => EMPTY_RECENT_PATHS
  )
}

function FileTypeIcon({ file }: { file: FileNode }) {
  if (file.fileType === 'image') return <FileImage className="h-4 w-4" />
  if (file.fileType === 'excalidraw') return <Pencil className="h-4 w-4" />
  if (file.fileType === 'markdown' || file.fileType === 'text') return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

export function QuickOpen() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const recentPaths = useRecentPaths()

  const files = useEditorStore(state => state.files)
  const currentFile = useEditorStore(state => state.currentFile)
  const language = useEditorStore(state => state.language)
  const setCurrentFile = useEditorStore(state => state.setCurrentFile)
  const openSearch = useEditorStore(state => state.openSearch)
  const toggleFocusMode = useEditorStore(state => state.toggleFocusMode)
  const toggleSidebar = useEditorStore(state => state.toggleSidebar)
  const saveCurrentFile = useEditorStore(state => state.saveCurrentFile)

  const flatFiles = useMemo(() => collectFiles(files), [files])
  const filesByPath = useMemo(
    () => new Map(flatFiles.map(file => [file.path, file])),
    [flatFiles]
  )

  const recentFiles = useMemo(
    () => recentPaths
      .map(path => filesByPath.get(path))
      .filter((file): file is FileNode => Boolean(file)),
    [filesByPath, recentPaths]
  )

  const recentPathSet = useMemo(() => new Set(recentFiles.map(file => file.path)), [recentFiles])
  const otherFiles = useMemo(
    () => flatFiles.filter(file => !recentPathSet.has(file.path)),
    [flatFiles, recentPathSet]
  )

  // Recent files are persisted outside React. The effect synchronizes the
  // active workspace file to that external store without maintaining a second
  // component-state copy of the same data.
  useEffect(() => {
    if (currentFile?.path) recordRecentPath(currentFile.path)
  }, [currentFile?.path])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setOpen(previous => !previous)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const openFile = useCallback((file: FileNode) => {
    setCurrentFile(file)
    close()
  }, [close, setCurrentFile])

  const handleSave = useCallback(async () => {
    close()
    const success = await saveCurrentFile()
    if (success) {
      toast.success(language === 'zh' ? '文件已保存' : 'File saved')
    } else {
      toast.error(language === 'zh' ? '保存失败' : 'Save failed')
    }
  }, [close, language, saveCurrentFile])

  const handleRefresh = useCallback(async () => {
    close()
    const result = await refreshWorkspaceFromDisk()

    if (result.ok) {
      toast.success(language === 'zh' ? '工作区已从磁盘刷新' : 'Workspace refreshed from disk')
      return
    }

    if (result.code === 'dirty_files') {
      const count = result.dirtyPaths?.length ?? 0
      toast.warning(
        language === 'zh'
          ? `仍有 ${count} 个未保存文件，已取消刷新以避免覆盖修改。`
          : `${count} unsaved file${count === 1 ? '' : 's'} detected. Refresh was cancelled to protect your edits.`
      )
      return
    }

    if (result.code === 'no_workspace') {
      toast.info(language === 'zh' ? '请先打开一个本地工作区。' : 'Open a local workspace first.')
      return
    }

    toast.error(language === 'zh' ? '刷新工作区失败' : 'Failed to refresh workspace')
  }, [close, language])

  const runAndClose = useCallback((action: () => void) => {
    close()
    action()
  }, [close])

  const renderFile = (file: FileNode) => (
    <CommandItem
      key={file.path}
      value={`${file.name} ${file.path}`}
      onSelect={() => openFile(file)}
      className="gap-3"
    >
      <FileTypeIcon file={file} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate">{file.name}</span>
          {file.isModified && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
              title={language === 'zh' ? '未保存' : 'Unsaved'}
            />
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{file.path}</div>
      </div>
      {currentFile?.path === file.path && (
        <span className="text-xs text-muted-foreground">
          {language === 'zh' ? '当前' : 'Current'}
        </span>
      )}
    </CommandItem>
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      title={language === 'zh' ? '快速打开' : 'Quick Open'}
      description={language === 'zh' ? '搜索文件或运行工作区命令' : 'Search files or run workspace commands'}
      className="sm:max-w-xl"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={language === 'zh' ? '搜索文件或命令...' : 'Search files or commands...'}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {language === 'zh' ? '没有匹配的文件或命令' : 'No matching files or commands'}
        </CommandEmpty>

        {recentFiles.length > 0 && (
          <CommandGroup heading={language === 'zh' ? '最近打开' : 'Recent'}>
            {recentFiles.map(renderFile)}
          </CommandGroup>
        )}

        {otherFiles.length > 0 && (
          <CommandGroup heading={language === 'zh' ? '工作区文件' : 'Workspace files'}>
            {otherFiles.map(renderFile)}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading={language === 'zh' ? '命令' : 'Commands'}>
          <CommandItem
            value={language === 'zh' ? '搜索 工作区 全文 查找' : 'search workspace find content'}
            onSelect={() => runAndClose(openSearch)}
          >
            <Search className="h-4 w-4" />
            <span>{language === 'zh' ? '搜索工作区内容' : 'Search workspace content'}</span>
            <CommandShortcut>Ctrl F</CommandShortcut>
          </CommandItem>
          <CommandItem
            value={language === 'zh' ? '刷新 工作区 磁盘 重新扫描' : 'refresh workspace disk rescan'}
            onSelect={() => void handleRefresh()}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{language === 'zh' ? '从磁盘刷新工作区' : 'Refresh workspace from disk'}</span>
          </CommandItem>
          <CommandItem
            value={language === 'zh' ? '保存 当前 文件' : 'save current file'}
            onSelect={() => void handleSave()}
            disabled={!currentFile}
          >
            <Save className="h-4 w-4" />
            <span>{language === 'zh' ? '保存当前文件' : 'Save current file'}</span>
            <CommandShortcut>Ctrl S</CommandShortcut>
          </CommandItem>
          <CommandItem
            value={language === 'zh' ? '专注 模式 切换' : 'toggle focus mode'}
            onSelect={() => runAndClose(toggleFocusMode)}
          >
            <Focus className="h-4 w-4" />
            <span>{language === 'zh' ? '切换专注模式' : 'Toggle focus mode'}</span>
          </CommandItem>
          <CommandItem
            value={language === 'zh' ? '侧边栏 显示 隐藏' : 'toggle sidebar'}
            onSelect={() => runAndClose(toggleSidebar)}
          >
            <PanelLeft className="h-4 w-4" />
            <span>{language === 'zh' ? '切换侧边栏' : 'Toggle sidebar'}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
