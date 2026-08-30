'use client'

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useEditorStore } from '@/store/editor-store'
import { collectWorkspaceFiles, resolveWikiLinkTarget } from '@/lib/wiki-links'
import { SlashMenu } from './SlashMenu'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { parseMarkdownBlocks } from './markdown/markdown-blocks'
import 'katex/dist/katex.min.css'

export interface TyporaEditorRef {
  getTextarea: () => HTMLTextAreaElement | null
  focus: () => void
  insertAtCursor: (before: string, after?: string) => void
}

interface TyporaEditorProps {
  content: string
  onChange: (content: string) => void
}

export const TyporaEditor = forwardRef<TyporaEditorRef, TyporaEditorProps>(
  function TyporaEditor({ content, onChange }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lineTextareaRef = useRef<HTMLTextAreaElement>(null)
    const slashStartPos = useRef<number | null>(null)

    const [isEditing, setIsEditing] = useState(false)
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
    const [editingLineValue, setEditingLineValue] = useState('')
    const [isDark, setIsDark] = useState(false)
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
    const [slashFilter, setSlashFilter] = useState('')

    const focusMode = useEditorStore(state => state.focusMode)
    const theme = useEditorStore(state => state.theme)
    const files = useEditorStore(state => state.files)
    const currentFile = useEditorStore(state => state.currentFile)
    const setCurrentFile = useEditorStore(state => state.setCurrentFile)

    useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateDarkMode = () => {
        if (theme === 'dark') setIsDark(true)
        else if (theme === 'light') setIsDark(false)
        else setIsDark(mediaQuery.matches)
      }

      updateDarkMode()
      const handler = () => {
        if (theme === 'system') setIsDark(mediaQuery.matches)
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }, [theme])

    useEffect(() => {
      if (!isEditing || !textareaRef.current) return
      textareaRef.current.focus()
      const pos = textareaRef.current.value.length
      textareaRef.current.selectionStart = pos
      textareaRef.current.selectionEnd = pos
    }, [isEditing])

    useEffect(() => {
      if (editingLineIndex === null || !lineTextareaRef.current) return
      const textarea = lineTextareaRef.current
      textarea.focus()
      const pos = editingLineValue.length
      textarea.selectionStart = pos
      textarea.selectionEnd = pos
    }, [editingLineIndex, editingLineValue.length])

    useImperativeHandle(ref, () => ({
      getTextarea: () => textareaRef.current,
      focus: () => {
        setEditingLineIndex(null)
        if (!isEditing) setIsEditing(true)
        requestAnimationFrame(() => textareaRef.current?.focus())
      },
      insertAtCursor: (before: string, after: string = '') => {
        if (editingLineIndex !== null && lineTextareaRef.current) {
          const textarea = lineTextareaRef.current
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const selected = textarea.value.slice(start, end)
          const updatedLine = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)

          setEditingLineValue(updatedLine)
          const lines = content.split('\n')
          lines[editingLineIndex] = updatedLine
          onChange(lines.join('\n'))

          requestAnimationFrame(() => {
            textarea.focus()
            const cursorPos = start + before.length + selected.length
            textarea.selectionStart = cursorPos
            textarea.selectionEnd = cursorPos
          })
          return
        }

        if (!isEditing) setIsEditing(true)
        setEditingLineIndex(null)

        requestAnimationFrame(() => {
          const textarea = textareaRef.current
          if (!textarea) return

          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const selected = textarea.value.slice(start, end)
          const updated = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)
          onChange(updated)

          requestAnimationFrame(() => {
            textarea.focus()
            const cursorPos = start + before.length + selected.length
            textarea.selectionStart = cursorPos
            textarea.selectionEnd = cursorPos
          })
        })
      },
    }), [content, editingLineIndex, isEditing, onChange])

    const applyLineEdit = useCallback((lineIndex: number, nextLine: string) => {
      const lines = content.split('\n')
      lines[lineIndex] = nextLine
      onChange(lines.join('\n'))
    }, [content, onChange])

    const handleLineTextareaKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (editingLineIndex === null) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setEditingLineIndex(null)
        return
      }

      if (event.key === 'Backspace') {
        const textarea = event.currentTarget
        const hasSelection = textarea.selectionStart !== textarea.selectionEnd
        const atLineStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0

        if (!hasSelection && atLineStart && editingLineIndex > 0) {
          event.preventDefault()
          const lines = content.split('\n')
          const currentLineContent = lines[editingLineIndex]
          const previousLineIndex = editingLineIndex - 1
          const previousLineContent = lines[previousLineIndex]
          const emptyListItem = /^(\s*)(?:[-+*]\s+\[(?: |x|X)\]|[-+*]|\d+[.)])\s*$/.test(currentLineContent)

          if (emptyListItem) {
            lines.splice(editingLineIndex, 1)
            setEditingLineIndex(previousLineIndex)
            setEditingLineValue(lines[previousLineIndex] ?? '')
            onChange(lines.join('\n'))
          } else {
            lines[previousLineIndex] = previousLineContent + currentLineContent
            lines.splice(editingLineIndex, 1)
            setEditingLineIndex(previousLineIndex)
            setEditingLineValue(lines[previousLineIndex])
            onChange(lines.join('\n'))

            requestAnimationFrame(() => {
              if (!lineTextareaRef.current) return
              lineTextareaRef.current.selectionStart = previousLineContent.length
              lineTextareaRef.current.selectionEnd = previousLineContent.length
            })
          }
        }
        return
      }

      if (event.key !== 'Enter') return

      event.preventDefault()
      const textarea = event.currentTarget
      const cursorPos = textarea.selectionStart
      const currentLine = textarea.value
      const before = currentLine.slice(0, cursorPos)
      const after = currentLine.slice(cursorPos)
      const todoMatch = before.match(/^(\s*)[-+*]\s+\[(?: |x|X)\]\s+(.*)$/)
      const unorderedMatch = before.match(/^(\s*)([-+*])\s+(.*)$/)
      const orderedMatch = before.match(/^(\s*)(\d+)([.)])\s+(.*)$/)
      const lines = content.split('\n')

      let updatedCurrentLine = currentLine
      let insertedLine = ''

      if (todoMatch) {
        const [, indent, itemContent] = todoMatch
        if (itemContent.trim() === '' && after.trim() === '') updatedCurrentLine = ''
        else {
          updatedCurrentLine = before
          insertedLine = `${indent}- [ ] ${after}`
        }
      } else if (unorderedMatch) {
        const [, indent, bullet, itemContent] = unorderedMatch
        if (itemContent.trim() === '' && after.trim() === '') updatedCurrentLine = ''
        else {
          updatedCurrentLine = before
          insertedLine = `${indent}${bullet} ${after}`
        }
      } else if (orderedMatch) {
        const [, indent, num, separator, itemContent] = orderedMatch
        if (itemContent.trim() === '' && after.trim() === '') updatedCurrentLine = ''
        else {
          updatedCurrentLine = before
          insertedLine = `${indent}${Number(num) + 1}${separator} ${after}`
        }
      } else {
        updatedCurrentLine = before
        insertedLine = after
      }

      lines[editingLineIndex] = updatedCurrentLine
      lines.splice(editingLineIndex + 1, 0, insertedLine)
      setEditingLineIndex(editingLineIndex + 1)
      setEditingLineValue(insertedLine)
      onChange(lines.join('\n'))
    }, [content, editingLineIndex, onChange])

    const handleWikiLinkClick = useCallback((targetName: string) => {
      const targetFile = resolveWikiLinkTarget(
        collectWorkspaceFiles(files),
        targetName,
        currentFile?.path
      )
      if (targetFile) setCurrentFile(targetFile)
    }, [currentFile?.path, files, setCurrentFile])

    const resolveImageSrc = useCallback((src?: string) => {
      if (!src || !currentFile?.path) return src
      if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src

      const currentParts = currentFile.path.split('/').filter(Boolean)
      currentParts.pop()

      for (const part of src.split('/').filter(Boolean)) {
        if (part === '.') continue
        if (part === '..') currentParts.pop()
        else currentParts.push(part)
      }

      const normalizedPath = `/${currentParts.join('/')}`
      const imageNode = collectWorkspaceFiles(files).find(file => file.path === normalizedPath)
      if (imageNode?.fileType === 'image' && imageNode.blobUrl) return imageNode.blobUrl
      return src
    }, [currentFile?.path, files])

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        const textarea = event.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const updated = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end)
        onChange(updated)
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        })
      }

      if (event.key === 'Escape') {
        setShowSlashMenu(false)
        setIsEditing(false)
        event.currentTarget.blur()
      }
    }, [onChange])

    const handleTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      const pos = event.target.selectionStart
      onChange(value)

      if (value[pos - 1] === '/') {
        const beforeCursor = value.substring(0, pos - 1)
        const lastNewline = beforeCursor.lastIndexOf('\n')
        const textOnLine = beforeCursor.substring(lastNewline + 1)

        if (textOnLine.trim() === '') {
          slashStartPos.current = pos
          setSlashFilter('')
          const rect = event.target.getBoundingClientRect()
          setSlashPosition({ top: rect.bottom + 5, left: rect.left + 24 })
          setShowSlashMenu(true)
          return
        }
      }

      if (showSlashMenu && slashStartPos.current !== null) {
        const filterText = value.substring(slashStartPos.current, pos)
        if (filterText.includes(' ')) {
          setShowSlashMenu(false)
          slashStartPos.current = null
        } else {
          setSlashFilter(filterText)
        }
      }
    }, [onChange, showSlashMenu])

    const handleSlashSelect = useCallback((command: { insert: string }) => {
      const textarea = textareaRef.current
      const startPos = slashStartPos.current
      if (!textarea || startPos === null) return

      const pos = textarea.selectionStart
      const value = textarea.value
      const before = value.substring(0, startPos - 1)
      const after = value.substring(pos)
      onChange(before + command.insert + after)
      setShowSlashMenu(false)
      slashStartPos.current = null

      requestAnimationFrame(() => {
        const cursorPos = before.length + command.insert.length
        textarea.focus()
        textarea.selectionStart = cursorPos
        textarea.selectionEnd = cursorPos
      })
    }, [onChange])

    const contentLines = useMemo(() => content.split('\n'), [content])
    const contentBlocks = useMemo(() => parseMarkdownBlocks(content), [content])

    return (
      <div className="editor-scrollbar relative h-full flex-1 overflow-y-auto">
        <div className={`min-h-full p-8 md:p-12 lg:p-16 ${focusMode ? 'mx-auto max-w-4xl' : ''}`}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setShowSlashMenu(false)
                setIsEditing(false)
              }}
              className="min-h-[70vh] w-full resize-none border-none bg-transparent p-0 text-sm leading-6 outline-none"
              spellCheck={false}
              autoFocus
            />
          ) : (
            <div className="min-h-[70vh] cursor-text">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {contentBlocks.map(block => {
                  const blockIsEditing = editingLineIndex !== null &&
                    editingLineIndex >= block.startLine &&
                    editingLineIndex <= block.endLine

                  return (
                    <div
                      key={`${block.startLine}-${block.endLine}`}
                      className="min-h-6"
                      onClick={() => {
                        setEditingLineIndex(block.startLine)
                        setEditingLineValue(contentLines[block.startLine] ?? '')
                      }}
                    >
                      {blockIsEditing ? (
                        <textarea
                          ref={lineTextareaRef}
                          value={editingLineValue}
                          onChange={(event) => {
                            setEditingLineValue(event.target.value)
                            if (editingLineIndex !== null) {
                              applyLineEdit(editingLineIndex, event.target.value)
                            }
                          }}
                          onKeyDown={handleLineTextareaKeyDown}
                          onBlur={() => setEditingLineIndex(null)}
                          className="w-full resize-none border-none bg-transparent p-0 text-sm leading-6 outline-none"
                          rows={1}
                          spellCheck={false}
                        />
                      ) : (
                        <div className="w-full text-sm leading-6">
                          {block.content.trim() === '' ? (
                            <div className="min-h-6">{'\u00A0'}</div>
                          ) : (
                            <MarkdownRenderer
                              content={block.content}
                              isDark={isDark}
                              onWikiLinkClick={handleWikiLinkClick}
                              resolveImageSrc={resolveImageSrc}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <SlashMenu
          visible={isEditing && showSlashMenu}
          position={slashPosition}
          filter={slashFilter}
          onSelect={handleSlashSelect}
          onClose={() => {
            setShowSlashMenu(false)
            slashStartPos.current = null
          }}
        />
      </div>
    )
  }
)
