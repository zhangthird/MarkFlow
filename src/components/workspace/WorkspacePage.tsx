'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { Code2, PanelRight } from 'lucide-react'
import { TyporaEditor, TyporaEditorRef } from '@/components/editor/TyporaEditor'
import { Sidebar } from '@/components/editor/Sidebar'
import { Toolbar } from '@/components/editor/Toolbar'
import { SearchDialog } from '@/components/editor/SearchDialog'
import { BacklinksPanel } from '@/components/editor/BacklinksPanel'
import { PanelPreferenceRuntime } from '@/components/workspace/PanelPreferenceRuntime'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store/editor-store'
import { useAppPreferences } from '@/hooks/useAppPreferences'
import { useWorkspaceDirectory } from '@/hooks/useWorkspaceDirectory'
import {
  DEFAULT_BACKLINKS_WIDTH,
  MAX_BACKLINKS_WIDTH,
  MIN_BACKLINKS_WIDTH,
  PANEL_PREFERENCE_KEYS,
  clampPanelWidth,
  parseStoredBoolean,
  parseStoredPanelWidth,
} from '@/lib/panel-preferences'

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

function scrollProgress(element: HTMLElement | null) {
  if (!element) return 0
  const maxScroll = element.scrollHeight - element.clientHeight
  return maxScroll > 0 ? element.scrollTop / maxScroll : 0
}

function restoreScrollProgress(selector: string, progress: number) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const nextContainer = document.querySelector<HTMLElement>(selector)
      if (!nextContainer) return
      const maxScroll = nextContainer.scrollHeight - nextContainer.clientHeight
      nextContainer.scrollTop = Math.max(0, maxScroll * progress)
    })
  })
}

function initialBacklinksOpen() {
  if (typeof window === 'undefined') return false
  return parseStoredBoolean(localStorage.getItem(PANEL_PREFERENCE_KEYS.backlinksOpen), false)
}

function initialBacklinksWidth() {
  if (typeof window === 'undefined') return DEFAULT_BACKLINKS_WIDTH
  return parseStoredPanelWidth(
    localStorage.getItem(PANEL_PREFERENCE_KEYS.backlinksWidth),
    MIN_BACKLINKS_WIDTH,
    MAX_BACKLINKS_WIDTH,
    DEFAULT_BACKLINKS_WIDTH
  )
}

export default function WorkspacePage() {
  const editorRef = useRef<TyporaEditorRef>(null)
  const [backlinksOpen, setBacklinksOpen] = useState(initialBacklinksOpen)
  const [backlinksWidth, setBacklinksWidth] = useState(initialBacklinksWidth)
  const [sourceMode, setSourceMode] = useState(false)
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  )

  const content = useEditorStore(state => state.content)
  const currentFile = useEditorStore(state => state.currentFile)
  const sidebarOpen = useEditorStore(state => state.sidebarOpen)
  const sidebarWidth = useEditorStore(state => state.sidebarWidth)
  const updateCurrentFileContent = useEditorStore(state => state.updateCurrentFileContent)
  const focusMode = useEditorStore(state => state.focusMode)
  const toggleFocusMode = useEditorStore(state => state.toggleFocusMode)
  const t = useEditorStore(state => state.t)
  const language = useEditorStore(state => state.language)

  useAppPreferences()
  const { openFolder } = useWorkspaceDirectory()

  const isTextLikeFile = currentFile?.fileType === 'markdown' || currentFile?.fileType === 'text'

  const toggleSourceMode = useCallback(() => {
    if (!isTextLikeFile) return

    const currentSelector = sourceMode ? '.markflow-source-mode' : '.markflow-editor'
    const nextSelector = sourceMode ? '.markflow-editor' : '.markflow-source-mode'
    const currentContainer = document.querySelector<HTMLElement>(currentSelector)
    const progress = scrollProgress(currentContainer)

    setSourceMode(value => !value)
    restoreScrollProgress(nextSelector, progress)
  }, [isTextLikeFile, sourceMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/' && isTextLikeFile) {
        event.preventDefault()
        toggleSourceMode()
        return
      }

      if (event.key === 'Escape' && focusMode) toggleFocusMode()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusMode, isTextLikeFile, toggleFocusMode, toggleSourceMode])

  const handleContentChange = useCallback((nextContent: string) => {
    updateCurrentFileContent(nextContent)
  }, [updateCurrentFileContent])

  const setBacklinksOpenWithPreference = useCallback((open: boolean) => {
    setBacklinksOpen(open)
    localStorage.setItem(PANEL_PREFERENCE_KEYS.backlinksOpen, String(open))
  }, [])

  const maxBacklinksWidthForViewport = useCallback(() => {
    const leftWidth = sidebarOpen ? sidebarWidth : 0
    const available = window.innerWidth - leftWidth - 420
    return Math.max(MIN_BACKLINKS_WIDTH, Math.min(MAX_BACKLINKS_WIDTH, available))
  }, [sidebarOpen, sidebarWidth])

  const startBacklinksResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = backlinksWidth
    let lastWidth = backlinksWidth

    const handleMove = (moveEvent: PointerEvent) => {
      const maxWidth = maxBacklinksWidthForViewport()
      lastWidth = clampPanelWidth(
        startWidth + startX - moveEvent.clientX,
        MIN_BACKLINKS_WIDTH,
        maxWidth,
        DEFAULT_BACKLINKS_WIDTH
      )
      setBacklinksWidth(lastWidth)
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(PANEL_PREFERENCE_KEYS.backlinksWidth, String(lastWidth))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [backlinksWidth, maxBacklinksWidthForViewport])

  const resetBacklinksWidth = useCallback(() => {
    const width = Math.min(DEFAULT_BACKLINKS_WIDTH, maxBacklinksWidthForViewport())
    setBacklinksWidth(width)
    localStorage.setItem(PANEL_PREFERENCE_KEYS.backlinksWidth, String(width))
  }, [maxBacklinksWidthForViewport])

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <PanelPreferenceRuntime />
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

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && !focusMode && <Sidebar />}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
          <div className="relative shrink-0 border-l border-sidebar-border bg-sidebar" style={{ width: backlinksWidth }}>
            <div
              className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none"
              onPointerDown={startBacklinksResize}
              onDoubleClick={resetBacklinksWidth}
              title={language === 'zh' ? '拖动调整宽度，双击恢复默认' : 'Drag to resize, double-click to reset'}
              aria-label={language === 'zh' ? '调整链接检查器宽度' : 'Resize link inspector'}
            >
              <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-primary/40" />
            </div>
            <BacklinksPanel onClose={() => setBacklinksOpenWithPreference(false)} />
          </div>
        )}

        {!backlinksOpen && !focusMode && isTextLikeFile && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 z-20 h-7 w-7 rounded-lg border-border/80 bg-background/85 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
            onClick={() => setBacklinksOpenWithPreference(true)}
            title={language === 'zh' ? '打开链接检查器' : 'Open link inspector'}
            aria-label={language === 'zh' ? '打开链接检查器' : 'Open link inspector'}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </Button>
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
                onClick={toggleSourceMode}
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
