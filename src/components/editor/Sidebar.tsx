'use client'

import React, { useRef, useState } from 'react'
import { useEditorStore, FileNode, detectFileType } from '@/store/editor-store'
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Folder, 
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  X,
  Pencil
} from 'lucide-react'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

function FileTreeItem({ node, depth, language, t }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)
  
  const { 
    currentFile, 
    setCurrentFile, 
    deleteFile, 
    renameFile,
    addFile
  } = useEditorStore()
  
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0
  const isSelected = currentFile?.path === node.path
  const isFolder = node.type === 'folder'
  const isModified = node.isModified
  const isExcalidraw = node.fileType === 'excalidraw'

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen)
    } else {
      setCurrentFile(node)
    }
  }

  const handleRename = () => {
    if (newName && newName !== node.name) {
      renameFile(node.path, newName)
    }
    setIsRenaming(false)
  }

  const handleDelete = () => {
    deleteFile(node.path)
  }

  const handleAddMarkdownFile = () => {
    const name = prompt(language === 'zh' ? '输入文件名 (例如: 新文件.md):' : 'Enter file name (e.g., NewFile.md):')
    if (name) {
      const fileName = name.endsWith('.md') || name.endsWith('.txt') ? name : `${name}.md`
      addFile(node.path, fileName, 'file')
    }
  }

  const handleAddExcalidrawFile = () => {
    const name = prompt(language === 'zh' ? '输入文件名 (例如: 新图表.excalidraw):' : 'Enter file name (e.g., NewDiagram.excalidraw):')
    if (name) {
      const fileName = name.endsWith('.excalidraw') ? name : `${name}.excalidraw`
      addFile(node.path, fileName, 'file')
    }
  }

  const handleAddFolder = () => {
    const name = prompt(language === 'zh' ? '输入文件夹名称:' : 'Enter folder name:')
    if (name) {
      addFile(node.path, name, 'folder')
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            onClick={handleClick}
            className={`
              group flex items-center gap-1 py-1.5 px-2 
              hover:bg-accent/50 cursor-pointer rounded-sm
              transition-colors duration-150
              ${isSelected ? 'bg-accent text-accent-foreground' : ''}
            `}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {/* Expand/Collapse arrow for folders */}
            {isFolder && (
              <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                {hasChildren ? (
                  isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                ) : null}
              </span>
            )}
            
            {/* Icon */}
            {!isFolder && isExcalidraw && <Pencil className="w-4 h-4 text-purple-500 shrink-0" />}
            {!isFolder && !isExcalidraw && <FileText className="w-4 h-4 text-blue-500 shrink-0" />}
            {isFolder && (isOpen ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            ))}
            
            {/* Name */}
            {isRenaming ? (
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setIsRenaming(false)
                }}
                className="h-5 text-xs px-1 py-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="truncate text-sm flex-1">{node.name}</span>
                {isModified && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />
                )}
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isFolder && (
            <>
              <ContextMenuItem onClick={handleAddMarkdownFile}>
                <FileText className="w-4 h-4 mr-2" />
                {t('newMarkdownFile')}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleAddExcalidrawFile}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('newExcalidrawFile')}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleAddFolder}>
                <Folder className="w-4 h-4 mr-2" />
                {t('newFolder')}
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            {t('rename')}
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Children */}
      {isFolder && isOpen && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              language={language}
              t={t}
            />
          ))}
        </div>
      )}
    </>
  )
}

interface SidebarProps {
  onOpenFolder: () => void
}

export function Sidebar({ onOpenFolder }: SidebarProps) {
  const { 
    files, 
    sidebarOpen, 
    sidebarWidth,
    rootFolderName,
    addFile,
    t,
    language
  } = useEditorStore()
  
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

  const handleNewFile = () => {
    if (newFileName) {
      if (newFileDialogType === 'excalidraw') {
        const fileName = newFileName.endsWith('.excalidraw') ? newFileName : `${newFileName}.excalidraw`
        addFile('/', fileName, 'file')
      } else {
        const fileName = newFileName.endsWith('.md') || newFileName.endsWith('.txt') ? newFileName : `${newFileName}.md`
        addFile('/', fileName, 'file')
      }
      setNewFileName('')
      setShowNewFileDialog(false)
    }
  }

  const handleNewFolder = () => {
    const name = prompt(language === 'zh' ? '输入文件夹名称:' : 'Enter folder name:')
    if (name) {
      addFile('/', name, 'folder')
    }
  }

  if (!sidebarOpen) return null

  return (
    <>
      <div 
        className="h-full bg-sidebar border-r border-sidebar-border flex flex-col"
        style={{ width: sidebarWidth }}
      >
        {/* Header */}
        <div className="p-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-sidebar-foreground truncate">
              {rootFolderName}
            </h2>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {language === 'zh' ? '新建' : 'New'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleNewMarkdown}>
                  <FileText className="w-4 h-4 mr-2" />
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewExcalidraw}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Excalidraw
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleNewFolder}
            >
              <Folder className="w-3 h-3 mr-1" />
              {language === 'zh' ? '文件夹' : 'Folder'}
            </Button>
          </div>
        </div>

        {/* File tree */}
        <div className="sidebar-scrollbar flex-1 overflow-y-auto py-2">
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm px-4">
              <p>{t('noFiles')}</p>
              <p className="mt-1 text-xs">{t('createFileToStart')}</p>
            </div>
          ) : (
            files.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                language={language}
                t={t}
              />
            ))
          )}
        </div>
      </div>

      {/* New File Dialog */}
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
                ? (language === 'zh' ? '输入文件名 (例如: 新图表.excalidraw)' : 'Enter file name (e.g., Diagram.excalidraw)')
                : (language === 'zh' ? '输入文件名 (例如: 新文档.md)' : 'Enter file name (e.g., Document.md)')}
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFile()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
            <Button onClick={handleNewFile}>
              {language === 'zh' ? '创建' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
