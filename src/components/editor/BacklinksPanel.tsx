'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileQuestion,
  FileText,
  Link,
  Search,
  X,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import {
  collectWorkspaceFiles,
  extractWikiLinks,
  resolveWikiLinkTarget,
  WikiLinkReference,
} from '@/lib/wiki-links'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BacklinksPanelProps {
  onClose?: () => void
}

export function BacklinksPanel({ onClose }: BacklinksPanelProps) {
  const files = useEditorStore(state => state.files)
  const currentFile = useEditorStore(state => state.currentFile)
  const setCurrentFile = useEditorStore(state => state.setCurrentFile)
  const language = useEditorStore(state => state.language)
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

  const unresolvedOutgoing = useMemo(() => {
    if (!currentFile) return 0
    return outgoingLinks.reduce((count, link) => {
      const target = resolveWikiLinkTarget(flatFiles, link.targetName, currentFile.path)
      return count + (target ? 0 : 1)
    }, 0)
  }, [currentFile, flatFiles, outgoingLinks])

  if (!currentFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
        <Link className="mb-2 h-7 w-7 opacity-25" />
        <p className="text-sm">{language === 'zh' ? '请先选择一个文件' : 'Select a file first'}</p>
      </div>
    )
  }

  return (
    <aside className="flex h-full flex-col bg-sidebar/95 text-sidebar-foreground">
      <div className="border-b border-sidebar-border/70 px-3 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Link className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {language === 'zh' ? '链接检查器' : 'Link Inspector'}
              </span>
            </div>
            <div className="truncate text-[13px] font-semibold" title={currentFile.name}>{currentFile.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground/65" title={currentFile.path}>{currentFile.path}</div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={onClose}
              title={language === 'zh' ? '关闭链接检查器' : 'Close link inspector'}
              aria-label={language === 'zh' ? '关闭链接检查器' : 'Close link inspector'}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder={language === 'zh' ? '搜索反向链接...' : 'Search backlinks...'}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            className="h-7 rounded-md border-sidebar-border/70 bg-background/50 pl-8 pr-7 text-xs shadow-none focus-visible:ring-1"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label={language === 'zh' ? '清空搜索' : 'Clear search'}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-scrollbar flex-1 overflow-y-auto">
        <section className="border-b border-sidebar-border/60">
          <div className="sticky top-0 z-10 flex h-8 items-center justify-between bg-sidebar/95 px-3 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-muted-foreground">
              {language === 'zh' ? '反向链接' : 'Backlinks'}
            </span>
            <span className="min-w-5 rounded-full bg-sidebar-accent px-1.5 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
              {backlinks.length}
            </span>
          </div>

          <div className="px-1.5 pb-2">
            {Object.keys(groupedBacklinks).length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-muted-foreground/70">
                <Link className="mb-2 h-6 w-6 opacity-25" />
                <p className="text-xs">
                  {searchQuery
                    ? (language === 'zh' ? '没有匹配的反向链接' : 'No matching backlinks')
                    : (language === 'zh' ? '还没有其他笔记引用此文件' : 'No notes reference this file yet')}
                </p>
              </div>
            ) : (
              Object.entries(groupedBacklinks).map(([path, links]) => {
                const isExpanded = expandedFiles.has(path)
                const firstLink = links[0]
                const shortPath = firstLink.sourcePath === firstLink.sourceName
                  ? ''
                  : firstLink.sourcePath.replace(new RegExp(`/?${firstLink.sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')

                return (
                  <div key={path} className="mb-0.5 last:mb-0">
                    <button
                      type="button"
                      className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50"
                      onClick={() => toggleExpanded(path)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      )}
                      <FileText className="h-3.5 w-3.5 shrink-0 text-sky-500/85" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium">{firstLink.sourceName}</div>
                        {shortPath && <div className="truncate text-[9px] text-muted-foreground/55">{shortPath}</div>}
                      </div>
                      <span className="rounded bg-sidebar-accent/70 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground">
                        {links.length}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="ml-5 border-l border-sidebar-border/70 pl-2 pr-1">
                        {links.map((link, index) => (
                          <button
                            key={`${link.sourcePath}-${link.line}-${index}`}
                            type="button"
                            className="group block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/40"
                            onClick={() => navigateToPath(link.sourcePath)}
                          >
                            <div className="text-[9px] font-medium tabular-nums text-muted-foreground/60">
                              {language === 'zh' ? `第 ${link.line} 行` : `Line ${link.line}`}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-sidebar-foreground/75 group-hover:text-sidebar-foreground">
                              {link.context}
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

        <section>
          <div className="sticky top-0 z-10 flex h-8 items-center justify-between bg-sidebar/95 px-3 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-muted-foreground">
              {language === 'zh' ? '出站链接' : 'Outgoing links'}
            </span>
            <span className="min-w-5 rounded-full bg-sidebar-accent px-1.5 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
              {outgoingLinks.length}
            </span>
          </div>

          <div className="px-1.5 pb-2">
            {outgoingLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-7 text-center text-muted-foreground/70">
                <FileText className="mb-2 h-6 w-6 opacity-20" />
                <p className="text-xs">{language === 'zh' ? '此文件还没有 Wiki Link' : 'This file has no Wiki Links yet'}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {outgoingLinks.map((link, index) => {
                  const targetFile = resolveWikiLinkTarget(flatFiles, link.targetName, currentFile.path)
                  const exists = Boolean(targetFile)

                  return (
                    <button
                      key={`${link.targetName}-${link.line}-${index}`}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                        exists ? 'hover:bg-sidebar-accent/50' : 'cursor-default opacity-60'
                      }`}
                      onClick={() => {
                        if (targetFile) setCurrentFile(targetFile)
                      }}
                    >
                      {exists ? (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-sky-500/85" />
                      ) : (
                        <FileQuestion className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium">{link.alias || link.targetName}</div>
                        <div className="truncate text-[9px] text-muted-foreground/60">
                          {link.alias ? link.targetName : (targetFile?.path || link.targetName)}
                        </div>
                      </div>
                      {!exists && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive/80">
                          {language === 'zh' ? '缺失' : 'Missing'}
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

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-sidebar-border/60 px-3 text-[10px] text-muted-foreground/65">
        <span>{backlinks.length} {language === 'zh' ? '反向引用' : 'backlinks'}</span>
        <span className={unresolvedOutgoing > 0 ? 'text-destructive/80' : ''}>
          {unresolvedOutgoing > 0
            ? `${unresolvedOutgoing} ${language === 'zh' ? '个缺失目标' : 'missing'}`
            : (language === 'zh' ? '链接已解析' : 'Links resolved')}
        </span>
      </div>
    </aside>
  )
}
