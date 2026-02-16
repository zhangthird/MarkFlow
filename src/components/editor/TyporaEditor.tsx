'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useEditorStore } from '@/store/editor-store'
import { SlashMenu } from './SlashMenu'
import { MermaidRenderer, isMermaidBlock } from './MermaidRenderer'
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

function isValidWikiLink(text: string): { name: string; extension: string } | null {
  const match = text.match(/^\[\[([^\]\.]+)(\.[^\]]+)\]\]$/)
  if (match) {
    return { name: match[1], extension: match[2] }
  }
  return null
}

function wikiLinkPlugin() {
  return (tree: any) => {
    function walk(node: any) {
      if (node.type === 'text' && node.value) {
        const regex = /\[\[([^\]\.]+\.[^\]]+)\]\]/g
        const parts: any[] = []
        let lastIndex = 0
        let match

        while ((match = regex.exec(node.value)) !== null) {
          if (match.index > lastIndex) {
            parts.push({ type: 'text', value: node.value.slice(lastIndex, match.index) })
          }
          parts.push({
            type: 'link',
            url: `wiki://${match[1]}`,
            children: [{ type: 'text', value: `[[${match[1]}]]` }],
            data: { wikiLink: true }
          })
          lastIndex = match.index + match[0].length
        }

        if (parts.length > 0) {
          if (lastIndex < node.value.length) {
            parts.push({ type: 'text', value: node.value.slice(lastIndex) })
          }
          return parts
        }
      }

      if (node.children) {
        const newChildren: any[] = []
        for (const child of node.children) {
          const result = walk(child)
          if (Array.isArray(result)) {
            newChildren.push(...result)
          } else {
            newChildren.push(child)
          }
        }
        node.children = newChildren
      }

      return node
    }

    walk(tree)
  }
}

function createMarkdownComponents(
  isDark: boolean,
  onWikiLinkClick?: (name: string) => void,
  resolveImageSrc?: (src?: string) => string | undefined
) {
  return {
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')
      const isInline = !match && !codeString.includes('\n')

      if (isInline) {
        return (
          <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'text-primary' : 'bg-muted'}`} {...props}>
            {children}
          </code>
        )
      }

      return (
        <SyntaxHighlighter
          style={isDark ? oneDark : oneLight}
          language={match ? match[1] : 'text'}
          PreTag="div"
          className="rounded-lg"
          customStyle={{ margin: 0, padding: '0.75rem', fontSize: '0.8rem', border: 'none', boxShadow: 'none' }}
          codeTagProps={{ style: { backgroundColor: 'transparent' } }}
        >
          {codeString}
        </SyntaxHighlighter>
      )
    },
    a: ({ href, children, ...props }: React.HTMLAttributes<HTMLAnchorElement>) => {
      if (href?.startsWith('wiki://')) {
        const targetName = href.replace('wiki://', '')
        const linkInfo = isValidWikiLink(`[[${targetName}]]`)

        if (linkInfo) {
          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors border border-primary/20"
              onClick={() => onWikiLinkClick?.(targetName)}
            >
              <span>{linkInfo.name}</span>
              <span className="text-xs opacity-60">{linkInfo.extension}</span>
            </span>
          )
        }
      }

      return <a href={href} {...props}>{children}</a>
    },
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      const resolvedSrc = resolveImageSrc?.(src) || src
      if (!resolvedSrc) return null

      return (
        <img
          src={resolvedSrc}
          alt={alt || 'image'}
          className="my-3 max-h-[60vh] w-auto max-w-full rounded-lg border border-border/60 bg-background object-contain shadow-sm"
          loading="lazy"
        />
      )
    }
  }
}

export const TyporaEditor = forwardRef<TyporaEditorRef, TyporaEditorProps>(
  function TyporaEditor({ content, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lineTextareaRef = useRef<HTMLTextAreaElement>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
    const [editingLineValue, setEditingLineValue] = useState('')
    const [isDark, setIsDark] = useState(false)
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
    const [slashFilter, setSlashFilter] = useState('')
    const slashStartPos = useRef<number | null>(null)

    const focusMode = useEditorStore((state) => state.focusMode)
    const theme = useEditorStore((state) => state.theme)
    const files = useEditorStore((state) => state.files)
    const currentFile = useEditorStore((state) => state.currentFile)
    const setCurrentFile = useEditorStore((state) => state.setCurrentFile)
    const setContent = useEditorStore((state) => state.setContent)

    useEffect(() => {
      const updateDarkMode = () => {
        if (theme === 'dark') setIsDark(true)
        else if (theme === 'light') setIsDark(false)
        else setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }

      updateDarkMode()

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
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
      const lineTextarea = lineTextareaRef.current

      // If the line textarea is already focused and the user has a caret/selection,
      // avoid overriding it when re-entering this effect.
      if (document.activeElement === lineTextarea) {
        return
      }

      lineTextarea.focus()
      const pos = editingLineValue.length
      lineTextarea.selectionStart = pos
      lineTextarea.selectionEnd = pos
    }, [editingLineIndex])

    useImperativeHandle(ref, () => ({
      getTextarea: () => textareaRef.current,
      focus: () => {
        setEditingLineIndex(null)
        if (!isEditing) setIsEditing(true)
        requestAnimationFrame(() => textareaRef.current?.focus())
      },
      insertAtCursor: (before: string, after: string = '') => {
        if (editingLineIndex !== null && lineTextareaRef.current) {
          const lineTextarea = lineTextareaRef.current
          const start = lineTextarea.selectionStart
          const end = lineTextarea.selectionEnd
          const selected = lineTextarea.value.slice(start, end)
          const updatedLine = lineTextarea.value.slice(0, start) + before + selected + after + lineTextarea.value.slice(end)
          setEditingLineValue(updatedLine)

          const lines = content.split('\n')
          lines[editingLineIndex] = updatedLine
          onChange(lines.join('\n'))

          requestAnimationFrame(() => {
            lineTextarea.focus()
            const cursorPos = start + before.length + selected.length
            lineTextarea.selectionStart = cursorPos
            lineTextarea.selectionEnd = cursorPos
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
      }
    }), [content, editingLineIndex, isEditing, onChange])

    const applyLineEdit = useCallback((lineIndex: number, nextLine: string) => {
      const lines = content.split('\n')
      lines[lineIndex] = nextLine
      onChange(lines.join('\n'))
    }, [content, onChange])

    const handleLineTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (editingLineIndex === null) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setEditingLineIndex(null)
        return
      }

      if (e.key === 'Backspace') {
        const textarea = e.currentTarget
        const hasSelection = textarea.selectionStart !== textarea.selectionEnd
        const atLineStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0
        const lineIsEmptyListItem = /^(\s*)(?:[-+*]\s+\[(?: |x|X)\]|[-+*]|\d+[.)])\s*$/.test(textarea.value)

        if (!hasSelection && atLineStart && lineIsEmptyListItem && editingLineIndex > 0) {
          e.preventDefault()
          const lines = content.split('\n')
          lines.splice(editingLineIndex, 1)

          const previousLineIndex = editingLineIndex - 1
          setEditingLineIndex(previousLineIndex)
          setEditingLineValue(lines[previousLineIndex] ?? '')
          onChange(lines.join('\n'))
        }

        return
      }

      if (e.key !== 'Enter') return

      e.preventDefault()
      const textarea = e.currentTarget
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
        if (itemContent.trim() === '' && after.trim() === '') {
          updatedCurrentLine = ''
        } else {
          updatedCurrentLine = before
          insertedLine = `${indent}- [ ] ${after}`
        }
      } else if (unorderedMatch) {
        const [, indent, bullet, itemContent] = unorderedMatch
        if (itemContent.trim() === '' && after.trim() === '') {
          updatedCurrentLine = ''
        } else {
          updatedCurrentLine = before
          insertedLine = `${indent}${bullet} ${after}`
        }
      } else if (orderedMatch) {
        const [, indent, num, separator, itemContent] = orderedMatch
        if (itemContent.trim() === '' && after.trim() === '') {
          updatedCurrentLine = ''
        } else {
          updatedCurrentLine = before
          insertedLine = `${indent}${Number(num) + 1}${separator} ${after}`
        }
      } else {
        updatedCurrentLine = before
        insertedLine = after
      }

      lines[editingLineIndex] = updatedCurrentLine

      if (insertedLine !== '') {
        lines.splice(editingLineIndex + 1, 0, insertedLine)
        setEditingLineIndex(editingLineIndex + 1)
        setEditingLineValue(insertedLine)
      } else {
        setEditingLineValue(updatedCurrentLine)
      }

      onChange(lines.join('\n'))
    }, [content, editingLineIndex, onChange])

    const handleWikiLinkClick = useCallback((targetName: string) => {
      const findFile = (nodes: typeof files, name: string): typeof files[0] | null => {
        const nameWithoutExt = name.replace(/\.[^.]+$/, '').toLowerCase()
        const nameWithExt = name.toLowerCase()

        for (const node of nodes) {
          if (node.type === 'file') {
            const nodeFullName = node.name.toLowerCase()
            const nodeNameWithoutExt = node.name.replace(/\.[^.]+$/, '').toLowerCase()
            if (nodeFullName === nameWithExt || nodeNameWithoutExt === nameWithoutExt) return node
          }
          if (node.children) {
            const found = findFile(node.children, name)
            if (found) return found
          }
        }
        return null
      }

      const targetFile = findFile(files, targetName)
      if (targetFile) {
        setCurrentFile(targetFile)
        setContent(targetFile.content || '')
      }
    }, [files, setContent, setCurrentFile])

    const resolveImageSrc = useCallback((src?: string) => {
      if (!src || !currentFile?.path) return src
      if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src

      const currentParts = currentFile.path.split('/').filter(Boolean)
      currentParts.pop()

      const relativeParts = src.split('/').filter(Boolean)
      for (const part of relativeParts) {
        if (part === '.') continue
        if (part === '..') currentParts.pop()
        else currentParts.push(part)
      }

      const normalizedPath = `/${currentParts.join('/')}`

      const findByPath = (nodes: typeof files): typeof files[number] | null => {
        for (const node of nodes) {
          if (node.type === 'file' && node.path === normalizedPath) return node
          if (node.children) {
            const found = findByPath(node.children)
            if (found) return found
          }
        }
        return null
      }

      const imageNode = findByPath(files)
      if (imageNode?.fileType === 'image' && imageNode.blobUrl) return imageNode.blobUrl

      return src
    }, [currentFile, files])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const updated = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end)
        onChange(updated)
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        })
      }

      if (e.key === 'Escape') {
        setShowSlashMenu(false)
        setIsEditing(false)
        e.currentTarget.blur()
      }
    }, [onChange])

    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      const pos = e.target.selectionStart
      onChange(value)

      if (value[pos - 1] === '/') {
        const beforeCursor = value.substring(0, pos - 1)
        const lastNewline = beforeCursor.lastIndexOf('\n')
        const textOnLine = beforeCursor.substring(lastNewline + 1)

        if (textOnLine.trim() === '') {
          slashStartPos.current = pos
          setSlashFilter('')

          const rect = e.target.getBoundingClientRect()
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

    const handleSlashSelect = useCallback((cmd: { insert: string }) => {
      const textarea = textareaRef.current
      const startPos = slashStartPos.current
      if (!textarea || startPos === null) return

      const pos = textarea.selectionStart
      const value = textarea.value
      const before = value.substring(0, startPos - 1)
      const after = value.substring(pos)
      const updated = before + cmd.insert + after
      onChange(updated)
      setShowSlashMenu(false)
      slashStartPos.current = null

      requestAnimationFrame(() => {
        const cursorPos = before.length + cmd.insert.length
        textarea.focus()
        textarea.selectionStart = cursorPos
        textarea.selectionEnd = cursorPos
      })
    }, [onChange])

    const markdownComponents = useMemo(
      () => createMarkdownComponents(isDark, handleWikiLinkClick, resolveImageSrc),
      [isDark, handleWikiLinkClick, resolveImageSrc]
    )

    const contentLines = useMemo(() => content.split('\n'), [content])

    return (
      <div ref={containerRef} className="editor-scrollbar relative flex-1 h-full overflow-y-auto">
        <div className={`min-h-full p-8 md:p-12 lg:p-16 ${focusMode ? 'max-w-4xl mx-auto' : ''}`}>
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
              className="w-full min-h-[70vh] resize-none border-none bg-transparent p-0 text-sm leading-6 outline-none"
              spellCheck={false}
              autoFocus
            />
          ) : (
            <div className="min-h-[70vh] cursor-text">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {contentLines.map((line, index) => (
                  <div
                    key={index}
                    className="min-h-6"
                    onClick={() => {
                      setEditingLineIndex(index)
                      setEditingLineValue(line)
                    }}
                  >
                    {editingLineIndex === index ? (
                      <textarea
                        ref={lineTextareaRef}
                        value={editingLineValue}
                        onChange={(e) => {
                          setEditingLineValue(e.target.value)
                          applyLineEdit(index, e.target.value)
                        }}
                        onKeyDown={handleLineTextareaKeyDown}
                        onBlur={() => {
                          setEditingLineIndex(null)
                        }}
                        className="w-full resize-none border-none bg-transparent p-0 text-sm leading-6 outline-none"
                        rows={1}
                        spellCheck={false}
                      />
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {line || ' '}
                      </ReactMarkdown>
                    )}
                  </div>
                ))}

                {contentLines.length === 0 && (
                  <div
                    className="min-h-6"
                    onClick={() => {
                      setEditingLineIndex(0)
                      setEditingLineValue('')
                    }}
                  />
                )}
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
