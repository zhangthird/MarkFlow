'use client'

import React, { useRef, useCallback, useState, useEffect } from 'react'
import { TyporaEditor, TyporaEditorRef } from '@/components/editor/TyporaEditor'
import { Sidebar } from '@/components/editor/Sidebar'
import { Toolbar } from '@/components/editor/Toolbar'
import { SearchDialog } from '@/components/editor/SearchDialog'
import { BacklinksPanel } from '@/components/editor/BacklinksPanel'
import { useEditorStore, FileNode, detectFileType } from '@/store/editor-store'
import { PanelLeft, PanelRightClose, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Dynamically import ExcalidrawEditor to avoid SSR issues
import dynamic from 'next/dynamic'

const PERSIST_DB_NAME = 'markflow-persistence'
const PERSIST_STORE = 'kv'
const ROOT_HANDLE_KEY = 'root-directory-handle'
const LAST_FILE_PATH_KEY = 'last-open-file-path'

async function getPersistDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PERSIST_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PERSIST_STORE)) {
        db.createObjectStore(PERSIST_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getPersistDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PERSIST_STORE, 'readwrite')
    tx.objectStore(PERSIST_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await getPersistDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PERSIST_STORE, 'readonly')
    const request = tx.objectStore(PERSIST_STORE).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

const ExcalidrawEditor = dynamic(
  () => import('@/components/editor/ExcalidrawEditor').then(mod => ({ default: mod.ExcalidrawEditor })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
)

export default function Home() {
  const editorRef = useRef<TyporaEditorRef>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  
  const {
    content,
    currentFile,
    sidebarOpen,
    toggleSidebar,
    updateCurrentFileContent,
    setFiles,
    setRootFolderName,
    setCurrentFile,
    focusMode,
    toggleFocusMode,
    setRootHandle,
    setTheme,
    setLanguage,
    t,
    theme,
    language
  } = useEditorStore()

  useEffect(() => {
    setIsMounted(true)
    
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
    
    // Initialize language from localStorage or browser preference
    const savedLanguage = localStorage.getItem('language') as 'zh' | 'en' | null
    if (savedLanguage) {
      setLanguage(savedLanguage)
    } else {
      // Check browser language
      const browserLang = navigator.language.toLowerCase()
      if (browserLang.startsWith('zh')) {
        setLanguage('zh')
      } else {
        setLanguage('en')
      }
    }
  }, [setTheme, setLanguage])

  // Helper to find first file in tree
  const findFirstFile = useCallback((nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file') return node
      if (node.children) {
        const found = findFirstFile(node.children)
        if (found) return found
      }
    }
    return null
  }, [])

  const findFileByPath = useCallback((nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file' && node.path === path) return node
      if (node.children) {
        const found = findFileByPath(node.children, path)
        if (found) return found
      }
    }
    return null
  }, [])

  const loadDirectory = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
    setRootHandle(dirHandle)

    const buildTree = async (
      handle: FileSystemDirectoryHandle,
      path: string = ''
    ): Promise<FileNode[]> => {
      const nodes: FileNode[] = []

      for await (const entry of handle.values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name

        if (entry.kind === 'directory') {
          const children = await buildTree(entry, entryPath)
          nodes.push({
            id: entryPath,
            name: entry.name,
            type: 'folder',
            path: `/${entryPath}`,
            children
          })
        } else if (entry.kind === 'file') {
          const file = await entry.getFile()
          const fileType = detectFileType(entry.name)
          const isReadableText = fileType === 'markdown' || fileType === 'text' || fileType === 'excalidraw'
          const fileContent = isReadableText ? await file.text() : undefined
            const blobUrl = fileType === 'image' || fileType === 'pdf' ? URL.createObjectURL(file) : undefined

          nodes.push({
            id: entryPath,
            name: entry.name,
            type: 'file',
            fileType,
            path: `/${entryPath}`,
            content: fileType === 'markdown' || fileType === 'text' ? fileContent : undefined,
            excalidrawData: fileType === 'excalidraw' ? fileContent : undefined,
            blobUrl,
            mimeType: file.type,
            handle: entry,
            isModified: false
          })
        }
      }

      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    }

    const files = await buildTree(dirHandle)
    setFiles(files)
    setRootFolderName(dirHandle.name)

    const lastPath = localStorage.getItem(LAST_FILE_PATH_KEY)
    const initialFile = lastPath ? findFileByPath(files, lastPath) : null
    const fallbackFile = initialFile ?? findFirstFile(files)
    if (fallbackFile) setCurrentFile(fallbackFile)
  }, [findFileByPath, findFirstFile, setCurrentFile, setFiles, setRootFolderName, setRootHandle])

  // Handle folder opening using File System Access API
  const handleOpenFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      toast.error(t('browserNotSupported'))
      return
    }

    try {
      const dirHandle = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      await loadDirectory(dirHandle)
      await idbSet(ROOT_HANDLE_KEY, dirHandle)
      
      toast.success(`${t('folderOpened')}: ${dirHandle.name}`)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error(t('openFolderFailed'))
        console.error(err)
      }
    }
  }, [loadDirectory, t])

  // Handle content change
  const handleContentChange = useCallback((newContent: string) => {
    updateCurrentFileContent(newContent)
  }, [updateCurrentFileContent])

  const isTextLikeFile = currentFile?.fileType === 'markdown' || currentFile?.fileType === 'text'

  useEffect(() => {
    if (currentFile?.path) {
      localStorage.setItem(LAST_FILE_PATH_KEY, currentFile.path)
    }
  }, [currentFile?.path])

  useEffect(() => {
    const restore = async () => {
      if (!('showDirectoryPicker' in window)) return
      try {
        const savedHandle = await idbGet<FileSystemDirectoryHandle>(ROOT_HANDLE_KEY)
        if (!savedHandle) return

        let permission = await savedHandle.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted') {
          permission = await savedHandle.requestPermission({ mode: 'readwrite' })
        }
        if (permission !== 'granted') {
          toast.info(language === 'zh' ? '已检测到上次目录，请点击“打开”重新授权。' : 'Previous folder detected. Click "Open" to re-authorize access.')
          return
        }

        await loadDirectory(savedHandle)
      } catch (error) {
        console.error('Failed to restore previous folder:', error)
        toast.error(
          language === 'zh'
            ? '无法自动恢复上次打开的目录，请通过“打开”按钮手动选择。'
            : 'Could not automatically restore the previous folder. Please use "Open" to select it again.'
        )
      }
    }

    void restore()
  }, [language, loadDirectory])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { currentFile } = useEditorStore.getState()
      if (currentFile?.isModified) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Exit focus mode with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        toggleFocusMode()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusMode, toggleFocusMode])

  if (!isMounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Toolbar - hidden in focus mode */}
      {!focusMode && (
        <Toolbar onOpenFolder={handleOpenFolder} editorRef={editorRef} />
      )}

      {/* Focus mode exit hint */}
      {focusMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur px-4 py-2 rounded-full text-sm text-muted-foreground border border-border shadow-sm opacity-0 hover:opacity-100 transition-opacity">
          {language === 'zh' ? (
            <>按 <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> 退出专注模式</>
          ) : (
            <>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to exit focus mode</>
          )}
        </div>
      )}

      {/* Search Dialog */}
      <SearchDialog />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && !focusMode && (
          <Sidebar onOpenFolder={handleOpenFolder} />
        )}

        {/* Sidebar toggle button when closed */}
        {!sidebarOpen && !focusMode && (
          <div className="absolute left-0 top-14 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none rounded-r-lg border-r border-y border-border bg-background shadow-sm"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Editor area */}
        <main className={`flex-1 flex flex-col overflow-hidden ${!sidebarOpen && !focusMode ? 'ml-10' : ''}`}>
          {currentFile ? (
            currentFile.fileType === 'excalidraw' ? (
              <ExcalidrawEditor initialData={currentFile.excalidrawData} />
            ) : currentFile.fileType === 'pdf' ? (
              <div className="flex-1 overflow-hidden bg-muted/20 p-4">
                <div className="h-full rounded-xl border border-border bg-background shadow-sm overflow-hidden">
                  <iframe
                    src={currentFile.blobUrl}
                    title={currentFile.name}
                    className="h-full w-full"
                  />
                </div>
              </div>
            ) : currentFile.fileType === 'image' ? (
              <div className="flex-1 overflow-auto bg-muted/20 p-6">
                <div className="mx-auto w-full max-w-5xl rounded-xl border border-border bg-background p-4 shadow-sm">
                  <img
                    src={currentFile.blobUrl}
                    alt={currentFile.name}
                    className="mx-auto max-h-[75vh] w-auto max-w-full rounded-md object-contain"
                  />
                  <div className="mt-3 text-center text-xs text-muted-foreground">
                    {currentFile.name}
                  </div>
                </div>
              </div>
            ) : isTextLikeFile ? (
              <TyporaEditor
                ref={editorRef}
                content={content}
                onChange={handleContentChange}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
                  <div className="mb-2 text-lg font-semibold">{currentFile.name}</div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'zh'
                      ? '该文件类型暂不支持直接编辑，但已经可以在文件树中浏览与管理。'
                      : 'This file type is not editable yet, but it is now visible and manageable in the file tree.'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">📝</div>
                <h2 className="text-xl font-semibold mb-2">{t('noFileSelected')}</h2>
                <p className="text-sm mb-4">{t('selectFileOrCreate')}</p>
                <Button onClick={handleOpenFolder}>
                  {t('openFolder')}
                </Button>
              </div>
            </div>
          )}
        </main>
        
        {/* Backlinks panel */}
        {backlinksOpen && !focusMode && isTextLikeFile && (
          <div className="w-64 border-l border-border bg-sidebar shrink-0">
            <BacklinksPanel onClose={() => setBacklinksOpen(false)} />
          </div>
        )}
        
        {/* Backlinks toggle button */}
        {!backlinksOpen && !focusMode && isTextLikeFile && (
          <div className="absolute right-0 top-14 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none rounded-l-lg border-l border-y border-border bg-background shadow-sm"
              onClick={() => setBacklinksOpen(true)}
              title={language === 'zh' ? '双向链接' : 'Backlinks'}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Status bar - hidden in focus mode */}
      {!focusMode && (
        <footer className="h-6 border-t border-border bg-muted/50 px-4 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <span>
              {currentFile?.fileType === 'excalidraw'
                ? 'Excalidraw'
                : currentFile?.fileType === 'image'
                  ? (language === 'zh' ? '图片' : 'Image')
                  : currentFile?.fileType === 'pdf'
                    ? 'PDF'
                  : currentFile?.fileType === 'binary'
                    ? (language === 'zh' ? '二进制' : 'Binary')
                    : t('markdown')}
            </span>
            <span>{t('utf8')}</span>
            {currentFile?.isModified && (
              <span className="text-orange-500">{t('unsaved')}</span>
            )}
          </div>
          {isTextLikeFile && (
            <div className="flex items-center gap-4">
              <span>{content.split(/\s+/).filter(Boolean).length} {t('words')}</span>
              <span>{content.length} {t('characters')}</span>
              <span>{content.split('\n').length} {t('lines')}</span>
            </div>
          )}
        </footer>
      )}
    </div>
  )
}
