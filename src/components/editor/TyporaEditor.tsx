'use client'

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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

function resizeSourceTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${Math.max(textarea.scrollHeight, window.innerHeight - 150)}px`
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

    useEffect(() => {
      if (!sourceMode || !sourceTextareaRef.current) return
      resizeSourceTextarea(sourceTextareaRef.current)
    }, [content, sourceMode])

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
      })
    }, [onChange])

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
          requestAnimationFrame(() => {
            const nextTextarea = sourceTextareaRef.current
            if (!nextTextarea) return
            nextTextarea.focus()
            nextTextarea.setSelectionRange(nextCursor, nextCursor)
            resizeSourceTextarea(nextTextarea)
          })
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
        requestAnimationFrame(() => {
          const nextTextarea = sourceTextareaRef.current
          if (!nextTextarea) return
          nextTextarea.focus()
          nextTextarea.setSelectionRange(nextStart, nextEnd)
          resizeSourceTextarea(nextTextarea)
        })
        return
      }

      if (start === end) {
        const nextContent = value.slice(0, start) + '  ' + value.slice(end)
        onChange(nextContent)
        requestAnimationFrame(() => {
          const nextTextarea = sourceTextareaRef.current
          if (!nextTextarea) return
          nextTextarea.focus()
          nextTextarea.setSelectionRange(start + 2, start + 2)
          resizeSourceTextarea(nextTextarea)
        })
        return
      }

      const selectedLines = value.slice(lineStart, end).split('\n')
      const indented = selectedLines.map(line => `  ${line}`).join('\n')
      const nextContent = value.slice(0, lineStart) + indented + value.slice(end)
      onChange(nextContent)

      requestAnimationFrame(() => {
        const nextTextarea = sourceTextareaRef.current
        if (!nextTextarea) return
        nextTextarea.focus()
        nextTextarea.setSelectionRange(start + 2, end + selectedLines.length * 2)
        resizeSourceTextarea(nextTextarea)
      })
    }

    if (!sourceMode) {
      return <BlockEditor ref={blockEditorRef} content={content} onChange={onChange} />
    }

    return (
      <div className="editor-scrollbar markflow-source-mode h-full flex-1 overflow-y-auto">
        <div className="markflow-source-mode-shell">
          <textarea
            ref={sourceTextareaRef}
            value={content}
            onChange={event => {
              onChange(event.target.value)
              requestAnimationFrame(() => resizeSourceTextarea(event.target))
            }}
            onKeyDown={handleSourceKeyDown}
            className="markflow-source-mode-editor"
            spellCheck={false}
            autoFocus
            aria-label="Markdown source code"
          />
        </div>
      </div>
    )
  }
)
