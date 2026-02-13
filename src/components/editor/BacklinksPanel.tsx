'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useEditorStore, FileNode } from '@/store/editor-store'
import { Link, FileText, ChevronRight, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LinkReference {
  sourcePath: string
  sourceName: string
  targetName: string
  line: number
  context: string
}

interface BacklinksPanelProps {
  onClose?: () => void
}

const WIKI_LINK_REGEX = /\[\[([^\]\.]+\.[^\]]+)\]\]/g

const normalizeFileName = (name: string) => name.toLowerCase()

const normalizeFileNameWithoutExt = (name: string) =>
  name.replace(/\.[^.]+$/, '').toLowerCase()

const extractWikiLinks = (
  content: string,
  sourcePath: string,
  sourceName: string
): LinkReference[] => {
  const links: LinkReference[] = []
  const lines = content.split('\n')

  let match: RegExpExecArray | null
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const targetName = match[1].trim()
    const position = match.index

    let currentPos = 0
    let lineNumber = 1
    for (let i = 0; i < lines.length; i++) {
      if (currentPos + lines[i].length >= position) {
        lineNumber = i + 1
        break
      }
      currentPos += lines[i].length + 1
    }

    links.push({
      sourcePath,
      sourceName,
      targetName,
      line: lineNumber,
      context: lines[lineNumber - 1] || ''
    })
  }

  WIKI_LINK_REGEX.lastIndex = 0
  return links
}

const collectFiles = (nodes: FileNode[]): FileNode[] => {
  const result: FileNode[] = []

  const traverse = (items: FileNode[]) => {
    for (const node of items) {
      if (node.type === 'file') result.push(node)
      if (node.children) traverse(node.children)
    }
  }

  traverse(nodes)
  return result
}

export function BacklinksPanel({ onClose }: BacklinksPanelProps) {
  const { files, currentFile, setCurrentFile, setContent, language } = useEditorStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!onClose) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const flatFiles = useMemo(() => collectFiles(files), [files])

  const fileIndex = useMemo(() => {
    const fullNameMap = new Map<string, FileNode>()
    const withoutExtMap = new Map<string, FileNode>()

    for (const file of flatFiles) {
      const normalizedFullName = normalizeFileName(file.name)
      const normalizedWithoutExt = normalizeFileNameWithoutExt(file.name)

      if (!fullNameMap.has(normalizedFullName)) {
        fullNameMap.set(normalizedFullName, file)
      }

      if (!withoutExtMap.has(normalizedWithoutExt)) {
        withoutExtMap.set(normalizedWithoutExt, file)
      }
    }

    return { fullNameMap, withoutExtMap }
  }, [flatFiles])

  const allLinks = useMemo(() => {
    const links: LinkReference[] = []
    for (const file of flatFiles) {
      if (file.content) {
        links.push(...extractWikiLinks(file.content, file.path, file.name))
      }
    }
    return links
  }, [flatFiles])

  const backlinks = useMemo(() => {
    if (!currentFile) return []

    const currentFileName = normalizeFileName(currentFile.name)
    const currentFileNameWithoutExt = normalizeFileNameWithoutExt(currentFile.name)

    return allLinks.filter((link) => {
      const linkTarget = normalizeFileName(link.targetName)
      const linkTargetWithoutExt = normalizeFileNameWithoutExt(link.targetName)
      return linkTarget === currentFileName || linkTargetWithoutExt === currentFileNameWithoutExt
    })
  }, [currentFile, allLinks])

  const outgoingLinks = useMemo(() => {
    if (!currentFile?.content) return []
    return extractWikiLinks(currentFile.content, currentFile.path, currentFile.name)
  }, [currentFile])

  const findFileByName = (name: string): FileNode | null => {
    const fullName = fileIndex.fullNameMap.get(normalizeFileName(name))
    if (fullName) return fullName

    return fileIndex.withoutExtMap.get(normalizeFileNameWithoutExt(name)) ?? null
  }

  const navigateToFile = (file: FileNode) => {
    setCurrentFile(file)
    setContent(file.content || '')
  }

  const toggleExpanded = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const filteredBacklinks = useMemo(() => {
    if (!searchQuery) return backlinks
    const query = searchQuery.toLowerCase()
    return backlinks.filter(
      (link) =>
        link.sourceName.toLowerCase().includes(query) || link.context.toLowerCase().includes(query)
    )
  }, [backlinks, searchQuery])

  const groupedBacklinks = useMemo(() => {
    const groups: Record<string, LinkReference[]> = {}

    for (const link of filteredBacklinks) {
      if (!groups[link.sourcePath]) groups[link.sourcePath] = []
      groups[link.sourcePath].push(link)
    }

    return groups
  }, [filteredBacklinks])

  if (!currentFile) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        {language === 'zh' ? '请先选择一个文件' : 'Select a file first'}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Link className="w-4 h-4" />
            {language === 'zh' ? '双向链接' : 'Backlinks'}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              title={language === 'zh' ? '关闭双向链接面板' : 'Close backlinks panel'}
              aria-label={language === 'zh' ? '关闭双向链接面板' : 'Close backlinks panel'}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Input
          placeholder={language === 'zh' ? '搜索文件名或上下文...' : 'Search file name or context...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 bg-background text-sm"
        />
      </div>

      <div className="sidebar-scrollbar flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="text-xs text-muted-foreground mb-2">
            {language === 'zh' ? '引用此文件' : 'References to this file'} ({backlinks.length})
          </div>

          {Object.keys(groupedBacklinks).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              {language === 'zh' ? '暂无反向链接' : 'No backlinks found'}
            </div>
          ) : (
            Object.entries(groupedBacklinks).map(([path, links]) => {
              const isExpanded = expandedFiles.has(path)
              const firstLink = links[0]

              return (
                <div key={path} className="mb-1">
                  <div
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 cursor-pointer text-sm"
                    onClick={() => toggleExpanded(path)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    )}
                    <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                    <span className="truncate">{firstLink.sourceName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{links.length}</span>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-2 border-l border-border">
                      {links.map((link, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-2 rounded hover:bg-accent/30 cursor-pointer"
                          onClick={() => {
                            const file = findFileByName(link.sourceName)
                            if (file) navigateToFile(file)
                          }}
                        >
                          <div className="text-muted-foreground">Line {link.line}</div>
                          <div className="truncate text-foreground/80 mt-0.5">
                            {link.context.substring(0, 50)}
                            {link.context.length > 50 && '...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">
            {language === 'zh' ? '此文件引用' : 'Links from this file'} ({outgoingLinks.length})
          </div>

          {outgoingLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-2">
              {language === 'zh' ? '无外链' : 'No outgoing links'}
            </div>
          ) : (
            outgoingLinks.map((link, idx) => {
              const targetFile = findFileByName(link.targetName)
              const exists = !!targetFile

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    exists ? 'hover:bg-accent/50 cursor-pointer' : 'opacity-50'
                  }`}
                  onClick={() => {
                    if (targetFile) navigateToFile(targetFile)
                  }}
                >
                  <FileText
                    className={`w-4 h-4 flex-shrink-0 ${
                      exists ? 'text-blue-500' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate">{link.targetName}</span>
                  {!exists && (
                    <span className="text-xs text-muted-foreground">
                      ({language === 'zh' ? '未找到' : 'not found'})
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="p-2 border-t border-border text-xs text-muted-foreground text-center">
        {language === 'zh' ? '使用 [[文件名.md]] 创建链接' : 'Use [[filename.md]] to create links'}
      </div>
    </div>
  )
}
