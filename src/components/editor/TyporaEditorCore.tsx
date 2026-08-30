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
import { MarkdownBlock, parseMarkdownBlocks } from './markdown/markdown-blocks'
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

interface EditingRange {
  startLine: number
  endLine: number
}

interface PendingInsert {
  before: string
  after: string
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${Math.max(28, textarea.scrollHeight)}px`
}

function caretViewportPosition(textarea: HTMLTextAreaElement, position: number) {
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const computed = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  const copiedProperties = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'textIndent', 'textAlign', 'wordSpacing', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'boxSizing', 'tabSize',
  ] as const

  mirror.style.position = 'fixed'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.left = `${rect.left - textarea.scrollLeft}px`
  mirror.style.top = `${rect.top - textarea.scrollTop}px`

  for (const property of copiedProperties) {
    mirror.style[property] = computed[property]
  }

  mirror.textContent = textarea.value.slice(0, position)
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  mirror.remove()

  return {
    left: Math.min(markerRect.left, window.innerWidth - 300),
    top: Math.min(markerRect.bottom + 6, window.innerHeight - 340),
  }
}

function replaceLineRange(content: string, range: EditingRange, nextValue: string) {
  const lines = content.split('\n')
  const nextLines = nextValue.split('\n')
  lines.splice(range.startLine, range.endLine - range.startLine + 1, ...nextLines)
  return {
    content: lines.join('\n'),
    endLine: range.startLine + nextLines.length - 1,
  }
}

export const TyporaEditor = forwardRef<TyporaEditorRef, TyporaEditorProps>(
  function TyporaEditor({ content, onChange }, ref) {
    const sourceTextareaRef = useRef<HTMLTextAreaElement>(null)
    const lastActiveStartRef = useRef<number | null>(null)
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)
    const pendingInsertRef = useRef<PendingInsert | null>(null)
    const slashStartPos = useRef<number | null>(null)

    const [editingRange, setEditingRange] = useState<EditingRange | null>(null)
    const [isDark, setIsDark] = useState(false)
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
    const [slashFilter, setSlashFilter] = useState('')

    const focusMode = useEditorStore(state => state.focusMode)
    const theme = useEditorStore(state => state.theme)
    const files = useEditorStore(state => state.files)
    const currentFile = useEditorStore(state => state.currentFile)
    const setCurrentFile = useEditorStore(state => state.setCurrentFile)

    const contentBlocks = useMemo(() => parseMarkdownBlocks(content), [content])
    const activeBlock = editingRange
      ? contentBlocks.find(block => block.startLine === editingRange.startLine) ?? null
      : null
    const activeSource = editingRange
      ? content.split('\n').slice(editingRange.startLine, editingRange.endLine + 1).join('\n')
      : ''

    const commitSourceValue = useCallback((nextValue: string) => {
      const range = editingRange
      if (!range) return
      const result = replaceLineRange(content, range, nextValue)
      if (result.endLine !== range.endLine) {
        setEditingRange({ startLine: range.startLine, endLine: result.endLine })
      }
      onChange(result.content)
    }, [content, editingRange, onChange])

    const activateBlock = useCallback((block: MarkdownBlock, cursor?: number) => {
      lastActiveStartRef.current = block.startLine
      pendingSelectionRef.current = cursor === undefined ? null : { start: cursor, end: cursor }
      setEditingRange({ startLine: block.startLine, endLine: block.endLine })
      setShowSlashMenu(false)
      slashStartPos.current = null
    }, [])

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
      const textarea = sourceTextareaRef.current
      if (!textarea || !editingRange) return
      textarea.focus()
      resizeTextarea(textarea)

      const selection = pendingSelectionRef.current
      if (selection) {
        const start = Math.min(selection.start, textarea.value.length)
        const end = Math.min(selection.end, textarea.value.length)
        textarea.setSelectionRange(start, end)
        pendingSelectionRef.current = null
      }

      const pendingInsert = pendingInsertRef.current
      if (!pendingInsert) return
      pendingInsertRef.current = null

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = textarea.value.slice(start, end)
      const nextValue = textarea.value.slice(0, start) + pendingInsert.before + selected + pendingInsert.after + textarea.value.slice(end)
      commitSourceValue(nextValue)
      const cursor = start + pendingInsert.before.length + selected.length
      pendingSelectionRef.current = { start: cursor, end: cursor }
      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.focus()
        nextTextarea.setSelectionRange(cursor, cursor)
        resizeTextarea(nextTextarea)
      })
    }, [commitSourceValue, editingRange])

    const chooseFallbackBlock = useCallback(() => {
      if (contentBlocks.length === 0) return null
      const remembered = lastActiveStartRef.current === null
        ? null
        : contentBlocks.find(block => block.startLine === lastActiveStartRef.current)
      return remembered ?? contentBlocks.find(block => block.kind !== 'blank') ?? contentBlocks[0]
    }, [contentBlocks])

    useImperativeHandle(ref, () => ({
      getTextarea: () => sourceTextareaRef.current,
      focus: () => {
        if (editingRange && sourceTextareaRef.current) {
          sourceTextareaRef.current.focus()
          return
        }
        const block = chooseFallbackBlock()
        if (block) activateBlock(block, block.content.length)
      },
      insertAtCursor: (before: string, after: string = '') => {
        const textarea = sourceTextareaRef.current
        if (editingRange && textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const selected = textarea.value.slice(start, end)
          const nextValue = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)
          commitSourceValue(nextValue)
          const cursor = start + before.length + selected.length
          requestAnimationFrame(() => {
            const nextTextarea = sourceTextareaRef.current
            if (!nextTextarea) return
            nextTextarea.focus()
            nextTextarea.setSelectionRange(cursor, cursor)
            resizeTextarea(nextTextarea)
          })
          return
        }

        const block = chooseFallbackBlock()
        if (!block) return
        pendingInsertRef.current = { before, after }
        pendingSelectionRef.current = { start: block.content.length, end: block.content.length }
        activateBlock(block, block.content.length)
      },
    }), [activateBlock, chooseFallbackBlock, commitSourceValue, editingRange])

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
    }, [currentFile, files])

    const showSlashMenuAtCaret = useCallback((textarea: HTMLTextAreaElement, slashPositionInSource: number) => {
      slashStartPos.current = slashPositionInSource + 1
      setSlashFilter('')
      setSlashPosition(caretViewportPosition(textarea, slashPositionInSource + 1))
      setShowSlashMenu(true)
    }, [])

    const handleSourceChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget
      const nextValue = textarea.value
      const cursor = textarea.selectionStart
      commitSourceValue(nextValue)
      requestAnimationFrame(() => resizeTextarea(textarea))

      if (nextValue[cursor - 1] === '/') {
        const lineStart = nextValue.lastIndexOf('\n', cursor - 2) + 1
        if (nextValue.slice(lineStart, cursor - 1).trim() === '') {
          showSlashMenuAtCaret(textarea, cursor - 1)
          return
        }
      }

      if (showSlashMenu && slashStartPos.current !== null) {
        const filter = nextValue.slice(slashStartPos.current, cursor)
        if (cursor < slashStartPos.current || /\s/.test(filter)) {
          setShowSlashMenu(false)
          slashStartPos.current = null
        } else {
          setSlashFilter(filter)
          setSlashPosition(caretViewportPosition(textarea, cursor))
        }
      }
    }, [commitSourceValue, showSlashMenu, showSlashMenuAtCaret])

    const moveToAdjacentBlock = useCallback((direction: -1 | 1, cursorAtEnd: boolean) => {
      if (!editingRange) return false
      const currentIndex = contentBlocks.findIndex(block => block.startLine === editingRange.startLine)
      if (currentIndex < 0) return false
      const target = contentBlocks[currentIndex + direction]
      if (!target) return false
      activateBlock(target, cursorAtEnd ? target.content.length : 0)
      return true
    }, [activateBlock, contentBlocks, editingRange])

    const mergeWithPreviousBlock = useCallback(() => {
      if (!editingRange || editingRange.startLine === 0) return false
      const currentIndex = contentBlocks.findIndex(block => block.startLine === editingRange.startLine)
      const previous = currentIndex > 0 ? contentBlocks[currentIndex - 1] : null
      if (!previous) return false

      const currentValue = content.split('\n').slice(editingRange.startLine, editingRange.endLine + 1).join('\n')
      const combined = previous.content + currentValue
      const lines = content.split('\n')
      const nextLines = combined.split('\n')
      lines.splice(previous.startLine, editingRange.endLine - previous.startLine + 1, ...nextLines)
      const nextContent = lines.join('\n')
      const cursor = previous.content.length

      lastActiveStartRef.current = previous.startLine
      pendingSelectionRef.current = { start: cursor, end: cursor }
      setEditingRange({
        startLine: previous.startLine,
        endLine: previous.startLine + nextLines.length - 1,
      })
      onChange(nextContent)
      return true
    }, [content, contentBlocks, editingRange, onChange])

    const handleSourceKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget

      if (showSlashMenu && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        if (showSlashMenu) {
          setShowSlashMenu(false)
          slashStartPos.current = null
        } else {
          setEditingRange(null)
          textarea.blur()
        }
        return
      }

      if (event.key === 'ArrowUp' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        if (moveToAdjacentBlock(-1, true)) event.preventDefault()
        return
      }

      if (event.key === 'ArrowDown' && textarea.selectionStart === textarea.value.length && textarea.selectionEnd === textarea.value.length) {
        if (moveToAdjacentBlock(1, false)) event.preventDefault()
        return
      }

      if (event.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        if (mergeWithPreviousBlock()) event.preventDefault()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = textarea.value.slice(start, end)
        const nextValue = textarea.value.slice(0, start) + '  ' + selected + textarea.value.slice(end)
        commitSourceValue(nextValue)
        const cursor = start + 2 + selected.length
        requestAnimationFrame(() => {
          const nextTextarea = sourceTextareaRef.current
          if (!nextTextarea) return
          nextTextarea.setSelectionRange(cursor, cursor)
          resizeTextarea(nextTextarea)
        })
        return
      }

      if (event.key !== 'Enter' || event.shiftKey) return

      const cursor = textarea.selectionStart
      const source = textarea.value
      const lineStart = source.lastIndexOf('\n', cursor - 1) + 1
      const lineEndCandidate = source.indexOf('\n', cursor)
      const lineEnd = lineEndCandidate === -1 ? source.length : lineEndCandidate
      const beforeCursor = source.slice(lineStart, cursor)
      const afterCursor = source.slice(cursor, lineEnd)
      const fullLine = source.slice(lineStart, lineEnd)

      const todoMatch = beforeCursor.match(/^(\s*)[-+*]\s+\[(?: |x|X)\]\s+(.*)$/)
      const unorderedMatch = beforeCursor.match(/^(\s*)([-+*])\s+(.*)$/)
      const orderedMatch = beforeCursor.match(/^(\s*)(\d+)([.)])\s+(.*)$/)

      let continuation: string | null = null
      let itemContent = ''

      if (todoMatch) {
        continuation = `${todoMatch[1]}- [ ] `
        itemContent = todoMatch[2]
      } else if (unorderedMatch) {
        continuation = `${unorderedMatch[1]}${unorderedMatch[2]} `
        itemContent = unorderedMatch[3]
      } else if (orderedMatch) {
        continuation = `${orderedMatch[1]}${Number(orderedMatch[2]) + 1}${orderedMatch[3]} `
        itemContent = orderedMatch[4]
      }

      if (continuation === null) return
      event.preventDefault()

      if (itemContent.trim() === '' && afterCursor.trim() === '' && fullLine.trim() !== '') {
        const nextValue = source.slice(0, lineStart) + source.slice(lineEnd)
        commitSourceValue(nextValue)
        requestAnimationFrame(() => sourceTextareaRef.current?.setSelectionRange(lineStart, lineStart))
        return
      }

      const insertion = `\n${continuation}`
      const nextValue = source.slice(0, cursor) + insertion + source.slice(cursor)
      commitSourceValue(nextValue)
      const nextCursor = cursor + insertion.length
      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.setSelectionRange(nextCursor, nextCursor)
        resizeTextarea(nextTextarea)
      })
    }, [commitSourceValue, mergeWithPreviousBlock, moveToAdjacentBlock, showSlashMenu])

    const handleSlashSelect = useCallback((command: { insert: string }) => {
      const textarea = sourceTextareaRef.current
      const startPos = slashStartPos.current
      if (!textarea || startPos === null) return

      const cursor = textarea.selectionStart
      const before = textarea.value.slice(0, startPos - 1)
      const after = textarea.value.slice(cursor)
      const nextValue = before + command.insert + after
      commitSourceValue(nextValue)
      setShowSlashMenu(false)
      slashStartPos.current = null

      const nextCursor = before.length + command.insert.length
      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.focus()
        nextTextarea.setSelectionRange(nextCursor, nextCursor)
        resizeTextarea(nextTextarea)
      })
    }, [commitSourceValue])

    return (
      <div className="editor-scrollbar markflow-editor relative h-full flex-1 overflow-y-auto">
        <div className={`markflow-document-shell ${focusMode ? 'markflow-document-shell-focus' : ''}`}>
          <div className="markflow-document prose dark:prose-invert">
            {contentBlocks.map(block => {
              if (
                editingRange &&
                block.startLine > editingRange.startLine &&
                block.startLine <= editingRange.endLine
              ) return null

              const blockIsEditing = editingRange?.startLine === block.startLine

              return (
                <div
                  key={`${block.startLine}-${block.kind}`}
                  className={`markflow-block ${blockIsEditing ? 'markflow-block-active' : ''}`}
                  data-kind={block.kind}
                  onClick={() => {
                    if (!blockIsEditing) activateBlock(block, block.content.length)
                  }}
                >
                  {blockIsEditing ? (
                    <textarea
                      ref={sourceTextareaRef}
                      value={activeSource}
                      onChange={handleSourceChange}
                      onKeyDown={handleSourceKeyDown}
                      onInput={event => resizeTextarea(event.currentTarget)}
                      onBlur={() => {
                        setShowSlashMenu(false)
                        slashStartPos.current = null
                        setEditingRange(null)
                      }}
                      className="markflow-source-editor"
                      rows={Math.max(1, activeSource.split('\n').length)}
                      spellCheck={activeBlock?.kind !== 'code' && activeBlock?.kind !== 'math' && activeBlock?.kind !== 'table'}
                      aria-label="Markdown source"
                    />
                  ) : block.kind === 'blank' ? (
                    <div className="markflow-empty-block">{'\u00A0'}</div>
                  ) : (
                    <MarkdownRenderer
                      content={block.content}
                      isDark={isDark}
                      onWikiLinkClick={handleWikiLinkClick}
                      resolveImageSrc={resolveImageSrc}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <SlashMenu
          visible={Boolean(editingRange) && showSlashMenu}
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
