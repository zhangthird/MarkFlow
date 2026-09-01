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
import {
  TyporaEditor as BlockEditor,
  type TyporaEditorRef,
} from './TyporaEditorCore'

export type { TyporaEditorRef } from './TyporaEditorCore'

interface TyporaEditorProps {
  content: string
  onChange: (content: string) => void
  sourceMode?: boolean
}

interface SourcePosition {
  line: number
  column: number
}

function resizeSourceTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${Math.max(textarea.scrollHeight, window.innerHeight - 150)}px`
}

function sourcePositionAt(text: string, offset: number): SourcePosition {
  const safeOffset = Math.max(0, Math.min(offset, text.length))
  let line = 1
  let lastNewline = -1

  for (let index = 0; index < safeOffset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1
      lastNewline = index
    }
  }

  return {
    line,
    column: safeOffset - lastNewline,
  }
}

function removeIndent(line: string) {
  if (line.startsWith('\t')) return { line: line.slice(1), removed: 1 }
  const spaces = line.match(/^ {1,2}/)?.[0].length ?? 0
  return { line: line.slice(spaces), removed: spaces }
}

export const TyporaEditor = forwardRef<TyporaEditorRef, TyporaEditorProps>(
  function TyporaEditor({ content, onChange, sourceMode = false }, ref) {
    const blockEditorRef = useRef<TyporaEditorRef>(null)
    const sourceTextareaRef = useRef<HTMLTextAreaElement>(null)
    const [sourcePosition, setSourcePosition] = useState<SourcePosition>({ line: 1, column: 1 })

    const sourceLineCount = useMemo(() => content.split('\n').length, [content])
    const sourceLineNumbers = useMemo(
      () => Array.from({ length: sourceLineCount }, (_, index) => String(index + 1)).join('\n'),
      [sourceLineCount]
    )
    const sourceGutterWidth = `${Math.max(3, String(sourceLineCount).length + 1)}ch`

    const updateSourcePosition = useCallback((textarea: HTMLTextAreaElement) => {
      setSourcePosition(sourcePositionAt(textarea.value, textarea.selectionStart))
    }, [])

    useEffect(() => {
      if (!sourceMode || !sourceTextareaRef.current) return
      const textarea = sourceTextareaRef.current
      resizeSourceTextarea(textarea)
      updateSourcePosition(textarea)
    }, [content, sourceMode, updateSourcePosition])

    const wrapSourceSelection = useCallback((before: string, after = '') => {
      const textarea = sourceTextareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = textarea.value.slice(start, end)
      const nextContent = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)
      onChange(nextContent)

      const nextStart = start + before.length
      const nextEnd = nextStart + selected.length
      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.focus()
        nextTextarea.setSelectionRange(nextStart, nextEnd)
        resizeSourceTextarea(nextTextarea)
        updateSourcePosition(nextTextarea)
      })
    }, [onChange, updateSourcePosition])

    useImperativeHandle(ref, () => ({
      getTextarea: () => sourceMode
        ? sourceTextareaRef.current
        : blockEditorRef.current?.getTextarea() ?? null,
      focus: () => {
        if (sourceMode) sourceTextareaRef.current?.focus()
        else blockEditorRef.current?.focus()
      },
      insertAtCursor: (before: string, after = '') => {
        if (sourceMode) wrapSourceSelection(before, after)
        else blockEditorRef.current?.insertAtCursor(before, after)
      },
    }), [sourceMode, wrapSourceSelection])

    const restoreSourceSelection = (
      nextStart: number,
      nextEnd = nextStart
    ) => {
      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.focus()
        nextTextarea.setSelectionRange(nextStart, nextEnd)
        resizeSourceTextarea(nextTextarea)
        updateSourcePosition(nextTextarea)
      })
    }

    const handleSourceKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget
      const modifier = event.ctrlKey || event.metaKey

      if (modifier && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'b') {
          event.preventDefault()
          wrapSourceSelection('**', '**')
          return
        }
        if (key === 'i') {
          event.preventDefault()
          wrapSourceSelection('*', '*')
          return
        }
        if (key === 'k') {
          event.preventDefault()
          wrapSourceSelection('[', '](https://)')
          return
        }
      }

      if (event.key !== 'Tab') return
      event.preventDefault()

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value
      const lineStart = value.lastIndexOf('\n', start - 1) + 1

      if (event.shiftKey) {
        if (start === end) {
          const lineEndCandidate = value.indexOf('\n', start)
          const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate
          const currentLine = value.slice(lineStart, lineEnd)
          const result = removeIndent(currentLine)
          if (result.removed === 0) return

          const nextContent = value.slice(0, lineStart) + result.line + value.slice(lineEnd)
          const nextCursor = Math.max(lineStart, start - result.removed)
          onChange(nextContent)
          restoreSourceSelection(nextCursor)
          return
        }

        const selectedLines = value.slice(lineStart, end).split('\n')
        const results = selectedLines.map(removeIndent)
        const nextSelectionText = results.map(result => result.line).join('\n')
        const removedTotal = results.reduce((sum, result) => sum + result.removed, 0)
        if (removedTotal === 0) return

        const nextContent = value.slice(0, lineStart) + nextSelectionText + value.slice(end)
        const nextStart = Math.max(lineStart, start - results[0].removed)
        const nextEnd = Math.max(nextStart, end - removedTotal)
        onChange(nextContent)
        restoreSourceSelection(nextStart, nextEnd)
        return
      }

      if (start === end) {
        const nextContent = value.slice(0, start) + '  ' + value.slice(end)
        onChange(nextContent)
        restoreSourceSelection(start + 2)
        return
      }

      const selectedLines = value.slice(lineStart, end).split('\n')
      const indented = selectedLines.map(line => `  ${line}`).join('\n')
      const nextContent = value.slice(0, lineStart) + indented + value.slice(end)
      onChange(nextContent)
      restoreSourceSelection(start + 2, end + selectedLines.length * 2)
    }

    if (!sourceMode) {
      return <BlockEditor ref={blockEditorRef} content={content} onChange={onChange} />
    }

    return (
      <div className="editor-scrollbar markflow-source-mode h-full flex-1 overflow-y-auto">
        <div className="markflow-source-mode-shell">
          <div className="markflow-source-mode-meta" aria-hidden="true">
            <span>Markdown Source</span>
            <span className="tabular-nums">Ln {sourcePosition.line}, Col {sourcePosition.column}</span>
          </div>
          <div className="markflow-source-mode-code">
            <pre
              className="markflow-source-mode-gutter"
              style={{ minWidth: sourceGutterWidth }}
              aria-hidden="true"
            >
              {sourceLineNumbers}
            </pre>
            <div className="markflow-source-mode-editor-pane">
              <div
                className="markflow-source-mode-current-line"
                style={{ transform: `translateY(${(sourcePosition.line - 1) * 100}%)` }}
                aria-hidden="true"
              />
              <textarea
                ref={sourceTextareaRef}
                value={content}
                onChange={event => {
                  onChange(event.target.value)
                  updateSourcePosition(event.target)
                  requestAnimationFrame(() => resizeSourceTextarea(event.target))
                }}
                onKeyDown={handleSourceKeyDown}
                onSelect={event => updateSourcePosition(event.currentTarget)}
                className="markflow-source-mode-editor"
                spellCheck={false}
                wrap="off"
                autoFocus
                aria-label="Markdown source code"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)
