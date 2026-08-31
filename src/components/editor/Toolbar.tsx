'use client'

import React, { useCallback, type ReactNode } from 'react'
import {
  Bold,
  Code,
  FileCode,
  FolderOpen,
  Heading1,
  Image as ImageIcon,
  Italic,
  Languages,
  Link,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Printer,
  Quote,
  Redo2,
  Save,
  Search,
  Sigma,
  Sun,
  Table,
  Undo2,
  Variable,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editor-store'
import { TyporaEditorRef } from '@/components/editor/TyporaEditor'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ToolbarProps {
  onOpenFolder: () => void
  editorRef: React.RefObject<TyporaEditorRef | null>
}

interface ToolbarActionProps {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  id?: string
}

function ToolbarAction({ label, onClick, children, disabled, id }: ToolbarActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-md"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarDivider() {
  return <div className="mx-1.5 h-5 w-px shrink-0 bg-border/80" aria-hidden="true" />
}

export function Toolbar({ onOpenFolder, editorRef }: ToolbarProps) {
  const {
    sidebarOpen,
    toggleSidebar,
    focusMode,
    toggleFocusMode,
    content,
    currentFile,
    theme,
    setTheme,
    saveCurrentFile,
    openSearch,
    language,
    setLanguage,
    undo,
    redo,
    canUndo,
    canRedo,
    t,
  } = useEditorStore()

  const isTextLikeFile = currentFile?.fileType === 'markdown' || currentFile?.fileType === 'text'

  const handleExportPDF = useCallback(async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${currentFile?.name || 'Document'}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #1a1a1a;
          }
          h1 { font-size: 2em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; margin-bottom: 1em; }
          h2 { font-size: 1.5em; margin-top: 1.5em; }
          h3 { font-size: 1.25em; margin-top: 1.25em; }
          code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
          pre { background: #2d2d2d; color: #ccc; padding: 16px; border-radius: 8px; overflow-x: auto; }
          pre code { background: none; padding: 0; }
          blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin-left: 0; color: #666; }
          table { border-collapse: collapse; width: 100%; margin: 1em 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; }
          th { background: #f4f4f4; font-weight: 600; }
          img { max-width: 100%; }
          a { color: #0066cc; }
          hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
          ul, ol { padding-left: 2em; }
          @media print {
            body { padding: 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <div id="content"></div>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script>
          const content = ${JSON.stringify(content)};
          marked.setOptions({ breaks: true, gfm: true });
          let processed = content
            .replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (match, math) => '<div class="math-block">' + math + '</div>')
            .replace(/\\$([^\\$]+)\\$/g, (match, math) => '<span class="math-inline">' + math + '</span>');
          document.getElementById('content').innerHTML = marked.parse(processed);
          document.querySelectorAll('.math-block').forEach(el => {
            katex.render(el.textContent, el, { displayMode: true, throwOnError: false });
          });
          document.querySelectorAll('.math-inline').forEach(el => {
            katex.render(el.textContent, el, { displayMode: false, throwOnError: false });
          });
          setTimeout(() => window.print(), 500);
        </script>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }, [content, currentFile])

  const insertText = useCallback((before: string, after: string = '') => {
    editorRef.current?.insertAtCursor(before, after)
  }, [editorRef])

  const handleSave = useCallback(async () => {
    const success = await saveCurrentFile()
    if (success) toast.success(t('fileSaved'))
    else toast.error(t('saveFailed'))
  }, [saveCurrentFile, t])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        void handleSave()
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        openSearch()
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, openSearch, redo, undo])

  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <TooltipProvider delayDuration={350}>
      <header className="flex h-12 shrink-0 items-center gap-0.5 overflow-hidden border-b border-border bg-background/95 px-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarAction
            label={sidebarOpen ? t('hideSidebar') : t('showSidebar')}
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </ToolbarAction>

          <ToolbarAction label={t('openFolder')} onClick={onOpenFolder}>
            <FolderOpen className="h-4 w-4" />
          </ToolbarAction>

          <ToolbarAction id="save-btn" label={t('saveShortcut')} onClick={() => void handleSave()}>
            <Save className="h-4 w-4" />
          </ToolbarAction>

          <ToolbarAction label={t('undo')} onClick={undo} disabled={!canUndo()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarAction>

          <ToolbarAction label={t('redo')} onClick={redo} disabled={!canRedo()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarAction>
        </div>

        {isTextLikeFile && (
          <>
            <ToolbarDivider />
            <div className="flex min-w-0 shrink-0 items-center gap-0.5">
              <ToolbarAction label={t('bold')} onClick={() => insertText('**', '**')}>
                <Bold className="h-4 w-4" />
              </ToolbarAction>

              <ToolbarAction label={t('italic')} onClick={() => insertText('*', '*')}>
                <Italic className="h-4 w-4" />
              </ToolbarAction>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-md"
                    title={t('heading1')}
                    aria-label={language === 'zh' ? '标题级别' : 'Heading level'}
                  >
                    <Heading1 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => insertText('# ')}>{t('heading1')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('## ')}>{t('heading2')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('### ')}>{t('heading3')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ToolbarAction label={t('bulletList')} onClick={() => insertText('- ')}>
                <List className="h-4 w-4" />
              </ToolbarAction>

              <ToolbarAction label={t('link')} onClick={() => insertText('[', '](url)')}>
                <Link className="h-4 w-4" />
              </ToolbarAction>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-md"
                    title={language === 'zh' ? '更多格式与插入' : 'More formatting and insert tools'}
                    aria-label={language === 'zh' ? '更多格式与插入' : 'More formatting and insert tools'}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => insertText('`', '`')}>
                    <Code className="mr-2 h-4 w-4" />{t('code')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('$', '$')}>
                    <Variable className="mr-2 h-4 w-4" />{t('math')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('1. ')}>
                    <ListOrdered className="mr-2 h-4 w-4" />{t('orderedList')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('> ')}>
                    <Quote className="mr-2 h-4 w-4" />{t('quote')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('\n```\ncode here\n```\n')}>
                    <FileCode className="mr-2 h-4 w-4" />{t('codeBlock')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('\n$$\nE = mc^2\n$$\n')}>
                    <Sigma className="mr-2 h-4 w-4" />{t('mathBlock')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('![alt](', ')')}>
                    <ImageIcon className="mr-2 h-4 w-4" />{t('image')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n')}>
                    <Table className="mr-2 h-4 w-4" />{t('table')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText('\n---\n')}>
                    <Minus className="mr-2 h-4 w-4" />{t('horizontalRule')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}

        <div className="min-w-0 flex-1 px-2">
          {currentFile && (
            <div
              className="mx-auto hidden max-w-[260px] items-center justify-center gap-1.5 truncate text-xs text-muted-foreground lg:flex"
              title={currentFile.path}
            >
              {currentFile.isModified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />}
              <span className="truncate">{currentFile.name}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarAction label={t('searchShortcut')} onClick={openSearch}>
            <Search className="h-4 w-4" />
          </ToolbarAction>

          <ToolbarAction
            label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <ThemeIcon className="h-4 w-4" />
          </ToolbarAction>

          <ToolbarAction
            label={focusMode ? t('exitFocusMode') : t('focusMode')}
            onClick={toggleFocusMode}
          >
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolbarAction>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md"
                title={language === 'zh' ? '应用菜单' : 'Application menu'}
                aria-label={language === 'zh' ? '应用菜单' : 'Application menu'}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
                <Languages className="mr-2 h-4 w-4" />
                {language === 'zh' ? 'Switch to English' : '切换到中文'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportPDF()} disabled={!isTextLikeFile}>
                <Printer className="mr-2 h-4 w-4" />{t('exportPDF')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  )
}
