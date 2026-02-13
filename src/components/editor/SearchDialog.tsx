'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SearchDialog() {
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    search,
    closeSearch,
    setSearchQuery,
    searchInFiles,
    nextSearchResult,
    prevSearchResult,
    files,
    setCurrentFile,
    setContent,
    t
  } = useEditorStore()

  // Focus input when opened
  useEffect(() => {
    if (search.isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [search.isOpen])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && search.isOpen) {
        closeSearch()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        if (!search.isOpen) {
          useEditorStore.getState().openSearch()
        }
      }
      if (search.isOpen && e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          prevSearchResult()
        } else {
          nextSearchResult()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [search.isOpen, closeSearch, nextSearchResult, prevSearchResult])

  // Search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.query) {
        searchInFiles()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search.query, searchInFiles])

  // Navigate to result
  const handleResultClick = useCallback((path: string) => {
    const findFile = (nodes: typeof files): typeof files[0] | null => {
      for (const node of nodes) {
        if (node.path === path) return node
        if (node.children) {
          const found = findFile(node.children)
          if (found) return found
        }
      }
      return null
    }
    
    const file = findFile(files)
    if (file) {
      setCurrentFile(file)
      setContent(file.content || '')
    }
  }, [files, setCurrentFile, setContent])

  if (!search.isOpen) return null

  return (
    <div className="fixed top-14 right-4 z-50 w-96 bg-background border border-border rounded-lg shadow-lg">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search.query}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="border-none shadow-none focus-visible:ring-0 h-8"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">
              {search.results.length > 0 
                ? `${search.currentIndex + 1}/${search.results.length}` 
                : t('noResults')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={prevSearchResult}
              disabled={search.results.length === 0}
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={nextSearchResult}
              disabled={search.results.length === 0}
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={closeSearch}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
      
      {search.results.length > 0 && (
        <div className="max-h-64 overflow-y-auto">
          {search.results.map((result, index) => (
            <button
              key={`${result.path}-${result.line}`}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                index === search.currentIndex ? 'bg-accent' : ''
              }`}
              onClick={() => {
                handleResultClick(result.path)
                closeSearch()
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {result.path}:{result.line}
                </span>
              </div>
              <div className="truncate text-muted-foreground">
                {highlightMatch(result.content, search.query)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Highlight search match
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)
  
  if (index === -1) return text
  
  return (
    <>
      {text.slice(0, index)}
      <span className="bg-yellow-200 dark:bg-yellow-800 text-foreground">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  )
}
