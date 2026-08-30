'use client'

import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  File,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore, FileNode } from '@/store/editor-store'
import {
  createWorkspaceEntry,
  deleteWorkspaceEntry,
  FileOperationResult,
  renameWorkspaceEntry,
} from '@/lib/file-operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FileTreeItemProps {
  node: FileNode
  depth: number
  language: 'zh' | 'en'
  t: (key: string) => string
}

function operationErrorMessage(result: FileOperationResult, language: 'zh' | 'en'): string {
  const zh = language === 'zh'
  switch (result.code) {
    case 'invalid_name':
      return zh ? '文件名无效，请避免空名称、`.`、`..` 或路径分隔符。' : 'Invalid name. Avoid empty names, `.`, `..`, or path separators.'
    case 'already_exists':
      return zh ? '同一目录中已经存在同名文件或文件夹。' : 'An entry with the same name already exists in this folder.'
    case 'parent_not_found':
      return zh ? '目标文件夹已经不存在，请刷新工作区后重试。' : 'The target folder no longer exists. Refresh the workspace and try again.'
    case 'not_found':
      return zh ? '目标已经不存在，请刷新工作区。' : 'The target no longer exists. Refresh the workspace.'
    case 'io_error':
      return zh ? '文件系统操作没有完成。请检查目录权限或磁盘状态后重试。' : 'The file-system operation did not complete. Check directory permission or disk state and try again.'
    default:
      return zh ? '文件操作失败。' : 'File operation failed.'
  }
}

function showFailure(result: FileOperationResult, language: 'zh' | 'en') {
  toast.error(operationErrorMessage(result, language))
}

async function createEntryWithFeedback(
  parentPath: string,
  name: string,
  type: 'file' | 'folder',
  language: 'zh' | 'en'
): Promise<boolean> {
  const result = await createWorkspaceEntry(parentPath, name, type)
  if (!result.ok) {
    showFailure(result, language)
    return false
  }
  toast.success(language === 'zh' ? `已创建 ${name}` : `Created ${name}`)
  return true
}

function FileTreeItem({ node, depth, language, t }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)
  const currentFile = useEditorStore(state => state.currentFile)
  const setCurrentFile = useEditorStore(state => state.setCurrentFile)

  const hasChildren = node.type === 'folder' && Boolean(node.children?.length)
  const isSelected = currentFile?.path === node.path
  const isFolder = node.type === 'folder'
  const isModified = node.isModified
  const isExcalidraw = node.fileType === 'excalidraw'
  const isImage = node.fileType === 'image'
  const isText = node.fileType === 'text' || node.fileType === 'markdown'

  const handleClick = () => {
    if (isFolder) setIsOpen(value => !value)
    else setCurrentFile(node)
  }

  const handleRename = async () => {
    if (!newName || newName === node.name) {
      setNewName(node.name)
      setIsRenaming(false)
      return
    }

    const result = await renameWorkspaceEntry(node.path, newName)
    if (!result.ok) {
      showFailure(result, language)
      setNewName(node.name)
      return
    }

    if (result.code !== 'unchanged') {
      toast.success(language === 'zh' ? `已重命名为 ${newName}` : `Renamed to ${newName}`)
    }
    setIsRenaming(false)
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      language === 'zh'
        ? `确定删除“${node.name}”${isFolder ? '及其全部内容' : ''}吗？此操作会同步删除磁盘中的内容。`
        : `Delete “${node.name}”${isFolder ? ' and everything inside it' : ''}? This also deletes it from disk.`
    )
    if (!confirmed) return

    const result = await deleteWorkspaceEntry(node.path)
    if (!result.ok) {
      showFailure(result, language)
      return
    }
    toast.success(language === 'zh' ? `已删除 ${node.name}` : `Deleted ${node.name}`)
  }

  const handleAddMarkdownFile = async () => {
    const name = prompt(language === 'zh' ? '输入文件名（例如：新文件.md）:' : 'Enter file name (e.g., NewFile.md):')
    if (!name) return
    const fileName = name.endsWith('.md') || name.endsWith('.txt') ? name : `${name}.md`
    await createEntryWithFeedback(node.path, fileName, 'file', language)
  }

  const handleAddExcalidrawFile = async () => {
    const name = prompt(language === 'zh' ? '输入文件名（例如：新图表.excalidraw）:' : 'Enter file name (e.g., NewDiagram.excalidraw):')
    if (!name) return
    const fileName = name.endsWith('.excalidraw') ? name : `${name}.excalidraw`
    await createEntryWithFeedback(node.path, fileName, 'file', language)
  }

  const handleAddFolder = async () => {
    const name = prompt(language === 'zh' ? '输入文件夹名称:' : 'Enter folder name:')
    if (name) await createEntryWithFeedback(node.path, name, 'folder', language)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            onClick={handleClick}
            className={`group flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50 ${isSelected ? 'bg-accent text-accent-foreground' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {isFolder && (
              <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                {hasChildren ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
              </span>
            )}

            {!isFolder && isExcalidraw && <Pencil className="h-4 w-4 shrink-0 text-purple-500" />}
            {!isFolder && isImage && <ImageIcon className="h-4 w-4 shrink-0 text-emerald-500" />}
            {!isFolder && !isExcalidraw && !isImage && isText && <FileText className="h-4 w-4 shrink-0 text-blue-500" />}
            {!isFolder && !isExcalidraw && !isImage && !isText && <File className="h-4 w-4 shrink-0 text-muted-foreground" />}
            {isFolder && (isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <Folder className="h-4 w-4 shrink-0 text-amber-500" />)}

            {isRenaming ? (
              <Input
                value={newName}
                onChange={event => setNewName(event.target.value)}
                onBlur={() => void handleRename()}
                onKeyDown={event => {
                  if (event.key === 'Enter') void handleRename()
                  if (event.key === 'Escape') {
                    setNewName(node.name)
                    setIsRenaming(false)
                  }
                }}
                className="h-5 px-1 py-0 text-xs"
                autoFocus
                onClick={event => event.stopPropagation()}
              />
            ) : (
              <>
                <span className="flex-1 truncate text-sm">{node.name}</span>
                {isModified && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}
              </>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          {isFolder && (
            <>
              <ContextMenuItem onClick={() => void handleAddMarkdownFile()}>
                <FileText className="mr-2 h-4 w-4" />{t('newMarkdownFile')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void handleAddExcalidrawFile()}>
                <Pencil className="mr-2 h-4 w-4" />{t('newExcalidrawFile')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void handleAddFolder()}>
                <Folder className="mr-2 h-4 w-4" />{t('newFolder')}
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onClick={() => {
            setNewName(node.name)
            setIsRenaming(true)
          }}>
            <Edit2 className="mr-2 h-4 w-4" />{t('rename')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void handleDelete()} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />{t('delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isFolder && isOpen && hasChildren && (
        <div>
          {node.children!.map(child => (
            <FileTreeItem key={child.id} node={child} depth={depth + 1} language={language} t={t} />
          ))}
        </div>
      )}
    </>
  )
}

export function Sidebar() {
  const files = useEditorStore(state => state.files)
  const sidebarOpen = useEditorStore(state => state.sidebarOpen)
  const sidebarWidth = useEditorStore(state => state.sidebarWidth)
  const rootFolderName = useEditorStore(state => state.rootFolderName)
  const t = useEditorStore(state => state.t)
  const language = useEditorStore(state => state.language)

  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [newFileDialogType, setNewFileDialogType] = useState<'markdown' | 'excalidraw'>('markdown')
  const [newFileName, setNewFileName] = useState('')

  const handleNewMarkdown = () => {
    setNewFileDialogType('markdown')
    setNewFileName('')
    setShowNewFileDialog(true)
  }

  const handleNewExcalidraw = () => {
    setNewFileDialogType('excalidraw')
    setNewFileName('')
    setShowNewFileDialog(true)
  }

  const handleNewFile = async () => {
    if (!newFileName) return
    const fileName = newFileDialogType === 'excalidraw'
      ? (newFileName.endsWith('.excalidraw') ? newFileName : `${newFileName}.excalidraw`)
      : (newFileName.endsWith('.md') || newFileName.endsWith('.txt') ? newFileName : `${newFileName}.md`)

    const created = await createEntryWithFeedback('/', fileName, 'file', language)
    if (!created) return
    setNewFileName('')
    setShowNewFileDialog(false)
  }

  const handleNewFolder = async () => {
    const name = prompt(language === 'zh' ? '输入文件夹名称:' : 'Enter folder name:')
    if (name) await createEntryWithFeedback('/', name, 'folder', language)
  }

  if (!sidebarOpen) return null

  return (
    <>
      <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar" style={{ width: sidebarWidth }}>
        <div className="border-b border-sidebar-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="truncate text-sm font-semibold text-sidebar-foreground">{rootFolderName}</h2>
          </div>

          <div className="flex flex-wrap gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Plus className="mr-1 h-3 w-3" />{language === 'zh' ? '新建' : 'New'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleNewMarkdown}><FileText className="mr-2 h-4 w-4" />Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewExcalidraw}><Pencil className="mr-2 h-4 w-4" />Excalidraw</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleNewFolder()}><Folder className="mr-2 h-4 w-4" />{language === 'zh' ? '文件夹' : 'Folder'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="sidebar-scrollbar flex-1 overflow-y-auto py-2">
          {files.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>{t('noFiles')}</p>
              <p className="mt-1 text-xs">{t('createFileToStart')}</p>
            </div>
          ) : files.map(node => (
            <FileTreeItem key={node.id} node={node} depth={0} language={language} t={t} />
          ))}
        </div>
      </div>

      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newFileDialogType === 'excalidraw'
                ? (language === 'zh' ? '新建 Excalidraw 文件' : 'Create New Excalidraw')
                : (language === 'zh' ? '新建 Markdown 文件' : 'Create New Markdown')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={newFileDialogType === 'excalidraw'
                ? (language === 'zh' ? '输入文件名（例如：新图表.excalidraw）' : 'Enter file name (e.g., Diagram.excalidraw)')
                : (language === 'zh' ? '输入文件名（例如：新文档.md）' : 'Enter file name (e.g., Document.md)')}
              value={newFileName}
              onChange={event => setNewFileName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void handleNewFile()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>{language === 'zh' ? '取消' : 'Cancel'}</Button>
            <Button onClick={() => void handleNewFile()}>{language === 'zh' ? '创建' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
