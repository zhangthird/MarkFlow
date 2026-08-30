'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { useEditorStore, FileNode } from '@/store/editor-store'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function findFileByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === path) return node
    if (node.children) {
      const found = findFileByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

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
    t,
  } = useEditorStore()

  const navigateToResult = useCallback((index: number) => {
    const result = search.results[index]
    if (!result) return
    const file = findFileByPath(files, result.path)
    if (file) setCurrentFile(file)
  }, [files, search.results, setCurrentFile])

  const handleNext = useCallback(() => {
    if (search.results.length === 0) return
    const nextIndex = (search.currentIndex + 1) % search.results.length
    nextSearchResult()
    navigateToResult(nextIndex)
  }, [navigateToResult, nextSearchResult, search.currentIndex, search.results.length])

  const handlePrevious = useCallback(() => {
    if (search.results.length === 0) return
    const previousIndex = search.currentIndex === 0
      ? search.results.length - 1
      : search.currentIndex - 1
    prevSearchResult()
    navigateToResult(previousIndex)
  }, [navigateToResult, prevSearchResult, search.currentIndex, search.results.length])

  useEffect(() => {
    if (search.isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [search.isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && search.isOpen) {
        closeSearch()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (!search.isOpen) useEditorStore.getState().openSearch()
        return
      }

      if (search.isOpen && event.key === 'Enter') {
        event.preventDefault()
        if (event.shiftKey) handlePrevious()
        else handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSearch, handleNext, handlePrevious, search.isOpen])

  // Always run the search function, including for an empty query, so clearing
  // the input also clears stale results from the previous query.
  useEffect(() => {
    const timer = window.setTimeout(searchInFiles, 250)
    return () => window.clearTimeout(timer)
  }, [search.query, searchInFiles])

  if (!search.isOpen) return null

  return (
    <div className="fixed top-14 right-4 z-50 w-96 bg-background border border-border rounded-lg shadow-lg">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search.query}
            onChange={(event) => setSearchQuery(event.target.value)}
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
              onClick={handlePrevious}
              disabled={search.results.length === 0}
              aria-label="Previous search result"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNext}
              disabled={search.results.length === 0}
              aria-label="Next search result"
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={closeSearch}
              aria-label="Close search"
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
              key={`${result.path}-${result.line}-${index}`}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                index === search.currentIndex ? 'bg-accent' : ''
              }`}
              onClick={() => {
                navigateToResult(index)
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
