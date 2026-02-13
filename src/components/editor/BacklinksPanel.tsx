'use client'

import React, { useMemo, useState } from 'react'
import { useEditorStore, FileNode } from '@/store/editor-store'
import { Link, FileText, ChevronRight, ChevronDown, Search } from 'lucide-react'
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

export function BacklinksPanel({ onClose }: BacklinksPanelProps) {
  const { files, currentFile, setCurrentFile, setContent, language } = useEditorStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  
  // Extract all [[wiki links]] from content - requires file extension
  const extractWikiLinks = (content: string, sourcePath: string, sourceName: string): LinkReference[] => {
    const links: LinkReference[] = []
    // Only match wiki links with file extensions like .md, .txt
    const regex = /\[\[([^\]\.]+\.[^\]]+)\]\]/g
    const lines = content.split('\n')
    
    let match
    while ((match = regex.exec(content)) !== null) {
      const targetName = match[1].trim()
      const position = match.index
      
      // Find line number
      let currentPos = 0
      let lineNumber = 0
      for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length >= position) {
          lineNumber = i + 1
          break
        }
        currentPos += lines[i].length + 1 // +1 for newline
      }
      
      links.push({
        sourcePath,
        sourceName,
        targetName,
        line: lineNumber,
        context: lines[lineNumber - 1] || ''
      })
    }
    
    return links
  }
  
  // Get all links from all files
  const allLinks = useMemo(() => {
    const links: LinkReference[] = []
    
    const traverseFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.content) {
          links.push(...extractWikiLinks(node.content, node.path, node.name))
        }
        if (node.children) {
          traverseFiles(node.children)
        }
      }
    }
    
    traverseFiles(files)
    return links
  }, [files])
  
  // Get backlinks for current file
  const backlinks = useMemo(() => {
    if (!currentFile) return []
    
    // Match by filename with extension or without
    const currentFileName = currentFile.name.toLowerCase()
    const currentFileNameWithoutExt = currentFile.name.replace(/\.[^.]+$/, '').toLowerCase()
    
    return allLinks.filter(link => {
      const linkTargetLower = link.targetName.toLowerCase()
      const linkTargetWithoutExt = link.targetName.replace(/\.[^.]+$/, '').toLowerCase()
      return linkTargetLower === currentFileName || 
             linkTargetWithoutExt === currentFileNameWithoutExt
    })
  }, [currentFile, allLinks])
  
  // Get outgoing links from current file
  const outgoingLinks = useMemo(() => {
    if (!currentFile || !currentFile.content) return []
    
    return extractWikiLinks(currentFile.content, currentFile.path, currentFile.name)
  }, [currentFile])
  
  // Find file by name (supports name with extension)
  const findFileByName = (name: string): FileNode | null => {
    const searchName = name.toLowerCase()
    const searchNameWithoutExt = name.replace(/\.[^.]+$/, '').toLowerCase()
    
    const search = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const nodeFullName = node.name.toLowerCase()
          const nodeNameWithoutExt = node.name.replace(/\.[^.]+$/, '').toLowerCase()
          // Match by full name or name without extension
          if (nodeFullName === searchName || nodeNameWithoutExt === searchNameWithoutExt) return node
        }
        if (node.children) {
          const found = search(node.children)
          if (found) return found
        }
      }
      return null
    }
    
    return search(files)
  }
  
  // Navigate to file
  const navigateToFile = (file: FileNode) => {
    setCurrentFile(file)
    setContent(file.content || '')
  }
  
  // Toggle file expansion
  const toggleExpanded = (path: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }
  
  // Filter backlinks by search
  const filteredBacklinks = useMemo(() => {
    if (!searchQuery) return backlinks
    const query = searchQuery.toLowerCase()
    return backlinks.filter(link => 
      link.sourceName.toLowerCase().includes(query) ||
      link.context.toLowerCase().includes(query)
    )
  }, [backlinks, searchQuery])
  
  // Group backlinks by source file
  const groupedBacklinks = useMemo(() => {
    const groups: Record<string, LinkReference[]> = {}
    
    for (const link of filteredBacklinks) {
      if (!groups[link.sourcePath]) {
        groups[link.sourcePath] = []
      }
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
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Link className="w-4 h-4" />
          {language === 'zh' ? '双向链接' : 'Backlinks'}
        </h3>
        <Input
          placeholder={language === 'zh' ? '搜索...' : 'Search...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      
      {/* Content */}
      <div className="sidebar-scrollbar flex-1 overflow-y-auto">
        {/* Backlinks section */}
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
                    <span className="text-xs text-muted-foreground ml-auto">
                      {links.length}
                    </span>
                  </div>
                  
                  {isExpanded && (
                    <div className="ml-6 pl-2 border-l border-border">
                      {links.map((link, idx) => (
                        <div 
                          key={idx}
                          className="text-xs p-2 rounded hover:bg-accent/30 cursor-pointer"
                          onClick={() => {
                            const file = findFileByName(link.sourceName.replace(/\.[^.]+$/, ''))
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
        
        {/* Outgoing links section */}
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
                  <FileText className={`w-4 h-4 flex-shrink-0 ${exists ? 'text-blue-500' : 'text-muted-foreground'}`} />
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
      
      {/* Footer */}
      <div className="p-2 border-t border-border text-xs text-muted-foreground text-center">
        {language === 'zh' ? '使用 [[文件名.md]] 创建链接' : 'Use [[filename.md]] to create links'}
      </div>
    </div>
  )
}
