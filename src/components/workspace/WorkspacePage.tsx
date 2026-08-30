'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { Code2, PanelLeft, PanelRight } from 'lucide-react'
import { TyporaEditor, TyporaEditorRef } from '@/components/editor/TyporaEditor'
import { Sidebar } from '@/components/editor/Sidebar'
import { Toolbar } from '@/components/editor/Toolbar'
import { SearchDialog } from '@/components/editor/SearchDialog'
import { BacklinksPanel } from '@/components/editor/BacklinksPanel'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store/editor-store'
import { useAppPreferences } from '@/hooks/useAppPreferences'
import { useWorkspaceDirectory } from '@/hooks/useWorkspaceDirectory'

const ExcalidrawEditor = dynamic(
  () => import('@/components/editor/ExcalidrawEditor').then(module => ({ default: module.ExcalidrawEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    ),
  }
)

const subscribeHydration = () => () => undefined
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

export default function WorkspacePage() {
  const editorRef = useRef<TyporaEditorRef>(null)
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  const [sourceMode, setSourceMode] = useState(false)
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  )

  const content = useEditorStore(state => state.content)
  const currentFile = useEditorStore(state => state.currentFile)
  const sidebarOpen = useEditorStore(state => state.sidebarOpen)
  const toggleSidebar = useEditorStore(state => state.toggleSidebar)
  const updateCurrentFileContent = useEditorStore(state => state.updateCurrentFileContent)
  const focusMode = useEditorStore(state => state.focusMode)
  const toggleFocusMode = useEditorStore(state => state.toggleFocusMode)
  const t = useEditorStore(state => state.t)
  const language = useEditorStore(state => state.language)

  useAppPreferences()
  const { openFolder } = useWorkspaceDirectory()

  const isTextLikeFile = currentFile?.fileType === 'markdown' || currentFile?.fileType === 'text'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/' && isTextLikeFile) {
        event.preventDefault()
        setSourceMode(value => !value)
        return
      }

      if (event.key === 'Escape' && focusMode) toggleFocusMode()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusMode, isTextLikeFile, toggleFocusMode])

  const handleContentChange = useCallback((nextContent: string) => {
    updateCurrentFileContent(nextContent)
  }, [updateCurrentFileContent])

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {!focusMode && <Toolbar onOpenFolder={openFolder} editorRef={editorRef} />}

      {focusMode && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:opacity-100">
          {language === 'zh' ? (
            <>按 <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> 退出专注模式</>
          ) : (
            <>Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> to exit focus mode</>
          )}
        </div>
      )}

      <SearchDialog />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && !focusMode && <Sidebar />}

        {!sidebarOpen && !focusMode && (
          <div className="absolute left-0 top-14 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none rounded-r-lg border-r border-y border-border bg-background shadow-sm"
              onClick={toggleSidebar}
              aria-label={language === 'zh' ? '打开侧边栏' : 'Open sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <main className={`flex flex-1 flex-col overflow-hidden ${!sidebarOpen && !focusMode ? 'ml-10' : ''}`}>
          {currentFile ? (
            currentFile.fileType === 'excalidraw' ? (
              <ExcalidrawEditor initialData={currentFile.excalidrawData} />
            ) : currentFile.fileType === 'pdf' ? (
              <div className="flex-1 overflow-hidden bg-muted/20 p-4">
                <div className="h-full overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                  <iframe src={currentFile.blobUrl} title={currentFile.name} className="h-full w-full" />
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
                  <div className="mt-3 text-center text-xs text-muted-foreground">{currentFile.name}</div>
                </div>
              </div>
            ) : isTextLikeFile ? (
              <TyporaEditor
                ref={editorRef}
                content={content}
                onChange={handleContentChange}
                sourceMode={sourceMode}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
                  <div className="mb-2 text-lg font-semibold">{currentFile.name}</div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'zh'
                      ? '该文件类型暂不支持直接编辑，但已经可以在文件树中浏览与管理。'
                      : 'This file type is not editable yet, but it is visible and manageable in the file tree.'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="p-8 text-center">
                <div className="mb-4 text-6xl">📝</div>
                <h2 className="mb-2 text-xl font-semibold">{t('noFileSelected')}</h2>
                <p className="mb-4 text-sm">{t('selectFileOrCreate')}</p>
                <Button onClick={openFolder}>{t('openFolder')}</Button>
              </div>
            </div>
          )}
        </main>

        {backlinksOpen && !focusMode && isTextLikeFile && (
          <div className="w-64 shrink-0 border-l border-border bg-sidebar">
            <BacklinksPanel onClose={() => setBacklinksOpen(false)} />
          </div>
        )}

        {!backlinksOpen && !focusMode && isTextLikeFile && (
          <div className="absolute right-0 top-14 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none rounded-l-lg border-l border-y border-border bg-background shadow-sm"
              onClick={() => setBacklinksOpen(true)}
              title={language === 'zh' ? '双向链接' : 'Backlinks'}
              aria-label={language === 'zh' ? '打开双向链接' : 'Open backlinks'}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {!focusMode && (
        <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground">
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
                      : sourceMode && isTextLikeFile
                        ? (language === 'zh' ? 'Markdown 源码' : 'Markdown Source')
                        : t('markdown')}
            </span>
            <span>{t('utf8')}</span>
            {currentFile?.isModified && <span className="text-orange-500">{t('unsaved')}</span>}
          </div>

          {isTextLikeFile && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={sourceMode ? 'secondary' : 'ghost'}
                size="sm"
                className="h-5 gap-1 px-1.5 text-[11px] font-normal"
                onClick={() => setSourceMode(value => !value)}
                title={language === 'zh' ? '切换源码模式 (Ctrl+/)' : 'Toggle source mode (Ctrl+/)'}
              >
                <Code2 className="h-3 w-3" />
                {sourceMode
                  ? (language === 'zh' ? '所见即所得' : 'WYSIWYG')
                  : (language === 'zh' ? '源码' : 'Source')}
              </Button>
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
