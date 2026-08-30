'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import {
  collectWorkspaceFiles,
  extractWikiLinks,
  resolveWikiLinkTarget,
  WikiLinkReference,
} from '@/lib/wiki-links'
import { Link, FileText, ChevronRight, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BacklinksPanelProps {
  onClose?: () => void
}

export function BacklinksPanel({ onClose }: BacklinksPanelProps) {
  const { files, currentFile, setCurrentFile, language } = useEditorStore()
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

  const flatFiles = useMemo(() => collectWorkspaceFiles(files), [files])

  const allLinks = useMemo(() => {
    return flatFiles.flatMap(file =>
      file.content ? extractWikiLinks(file.content, file.path, file.name) : []
    )
  }, [flatFiles])

  const backlinks = useMemo(() => {
    if (!currentFile) return []

    return allLinks.filter(link => {
      const target = resolveWikiLinkTarget(flatFiles, link.targetName, link.sourcePath)
      return target?.path === currentFile.path
    })
  }, [allLinks, currentFile, flatFiles])

  const outgoingLinks = useMemo(() => {
    if (!currentFile?.content) return []
    return extractWikiLinks(currentFile.content, currentFile.path, currentFile.name)
  }, [currentFile])

  const navigateToPath = (path: string) => {
    const file = flatFiles.find(item => item.path === path)
    if (file) setCurrentFile(file)
  }

  const toggleExpanded = (path: string) => {
    setExpandedFiles(previous => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const filteredBacklinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return backlinks

    return backlinks.filter(link =>
      link.sourceName.toLowerCase().includes(query) || link.context.toLowerCase().includes(query)
    )
  }, [backlinks, searchQuery])

  const groupedBacklinks = useMemo(() => {
    return filteredBacklinks.reduce<Record<string, WikiLinkReference[]>>((groups, link) => {
      if (!groups[link.sourcePath]) groups[link.sourcePath] = []
      groups[link.sourcePath].push(link)
      return groups
    }, {})
  }, [filteredBacklinks])

  if (!currentFile) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        {language === 'zh' ? '请先选择一个文件' : 'Select a file first'}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Link className="h-4 w-4 text-primary" />
            {language === 'zh' ? '双向链接' : 'Backlinks'}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-8 bg-background text-sm"
        />
      </div>

      <div className="sidebar-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-md border border-border/70 bg-background/70">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
            <span>{language === 'zh' ? '引用此文件' : 'References to this file'}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{backlinks.length}</span>
          </div>

          <div className="p-2">
            {Object.keys(groupedBacklinks).length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {language === 'zh' ? '暂无反向链接' : 'No backlinks found'}
              </div>
            ) : (
              Object.entries(groupedBacklinks).map(([path, links]) => {
                const isExpanded = expandedFiles.has(path)
                const firstLink = links[0]

                return (
                  <div key={path} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60"
                      onClick={() => toggleExpanded(path)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      )}
                      <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                      <span className="truncate">{firstLink.sourceName}</span>
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {links.length}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="ml-5 mt-1 space-y-1 border-l border-border pl-2">
                        {links.map((link, index) => (
                          <button
                            key={`${link.sourcePath}-${link.line}-${index}`}
                            type="button"
                            className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40"
                            onClick={() => navigateToPath(link.sourcePath)}
                          >
                            <div className="text-muted-foreground">
                              {language === 'zh' ? `第 ${link.line} 行` : `Line ${link.line}`}
                            </div>
                            <div className="mt-0.5 truncate text-foreground/80">
                              {link.context.substring(0, 70)}
                              {link.context.length > 70 && '...'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-md border border-border/70 bg-background/70">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2 text-xs text-muted-foreground">
            <span>{language === 'zh' ? '此文件引用' : 'Links from this file'}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{outgoingLinks.length}</span>
          </div>

          <div className="p-2">
            {outgoingLinks.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {language === 'zh' ? '无外链' : 'No outgoing links'}
              </div>
            ) : (
              <div className="space-y-1">
                {outgoingLinks.map((link, index) => {
                  const targetFile = resolveWikiLinkTarget(flatFiles, link.targetName, currentFile.path)
                  const exists = Boolean(targetFile)

                  return (
                    <button
                      key={`${link.targetName}-${link.line}-${index}`}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        exists ? 'hover:bg-accent/60' : 'opacity-60'
                      }`}
                      onClick={() => {
                        if (targetFile) setCurrentFile(targetFile)
                      }}
                    >
                      <FileText
                        className={`h-4 w-4 flex-shrink-0 ${
                          exists ? 'text-blue-500' : 'text-muted-foreground'
                        }`}
                      />
                      <span className="truncate">{link.alias || link.targetName}</span>
                      {link.alias && (
                        <span className="truncate text-[10px] text-muted-foreground">{link.targetName}</span>
                      )}
                      {!exists && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {language === 'zh' ? '未找到' : 'Not found'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
        {language === 'zh'
          ? '支持 [[文件名]]、[[文件名.md]]、[[目录/文件名]] 和 [[文件名|别名]]'
          : 'Supports [[note]], [[note.md]], [[folder/note]], and [[note|alias]]'}
      </div>
    </div>
  )
}
