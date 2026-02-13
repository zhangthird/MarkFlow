'use client'

import React, { useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { TyporaEditorRef } from '@/components/editor/TyporaEditor'
import { 
  PanelLeftClose, 
  PanelLeft,
  FolderOpen,
  Printer,
  Maximize2,
  Minimize2,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Link,
  ImageIcon,
  Table,
  Minus,
  Sun,
  Moon,
  Search,
  Save,
  Languages,
  Undo2,
  Redo2,
  Sigma,
  FileCode,
  Variable
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
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
    t
  } = useEditorStore()

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
    if (editorRef.current) {
      editorRef.current.insertAtCursor(before, after)
    }
  }, [editorRef])

  const handleSave = useCallback(async () => {
    const success = await saveCurrentFile()
    if (success) {
      toast.success(t('fileSaved'))
    } else {
      toast.error(t('saveFailed'))
    }
  }, [saveCurrentFile, t])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        openSearch()
      }
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, openSearch, undo, redo])

  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <header className="h-12 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-3 gap-1 shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSidebar}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sidebarOpen ? t('hideSidebar') : t('showSidebar')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onOpenFolder}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('openFolder')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Save button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id="save-btn"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('saveShortcut')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Undo button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={undo}
                disabled={!canUndo()}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('undo')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Redo button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={redo}
                disabled={!canRedo()}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('redo')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border mx-2" />

      {/* Format tools - only show for markdown files */}
      {(currentFile?.fileType === 'markdown' || currentFile?.fileType === 'text') && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('**', '**')}
                >
                  <Bold className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('bold')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('*', '*')}
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('italic')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('`', '`')}
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('code')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('$', '$')}
                >
                  <Variable className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('math')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Headings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Heading1 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => insertText('# ')}>
                {t('heading1')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertText('## ')}>
                {t('heading2')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertText('### ')}>
                {t('heading3')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* List tools */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('- ')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('bulletList')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('1. ')}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('orderedList')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('> ')}
                >
                  <Quote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('quote')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-2" />

          {/* Code & Math */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('\n```\ncode here\n```\n')}
                >
                  <FileCode className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('codeBlock')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('\n$$\nE = mc^2\n$$\n')}
                >
                  <Sigma className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('mathBlock')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-2" />

          {/* Insert tools */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('[', '](url)')}
                >
                  <Link className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('link')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('![alt](', ')')}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('image')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n')}
                >
                  <Table className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('table')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertText('\n---\n')}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('horizontalRule')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* File name with modification indicator */}
      {currentFile && (
        <span className="text-sm text-muted-foreground mr-2 hidden sm:inline flex items-center gap-1">
          {currentFile.isModified && <span className="w-2 h-2 bg-orange-500 rounded-full" />}
          {currentFile.name}
        </span>
      )}

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Language toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              >
                <Languages className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {language === 'zh' ? 'Switch to English' : '切换到中文'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Search button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={openSearch}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('searchShortcut')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Theme toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <ThemeIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {theme === 'dark' ? t('switchToLight') : t('switchToDark')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Focus mode */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleFocusMode}
              >
                {focusMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {focusMode ? t('exitFocusMode') : t('focusMode')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* PDF export */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleExportPDF}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('exportPDF')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
