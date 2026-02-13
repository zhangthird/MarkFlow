'use client'

import React, { useCallback, useRef, useMemo, forwardRef, useImperativeHandle, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useEditorStore } from '@/store/editor-store'
import { SlashMenu, useSlashCommand } from './SlashMenu'
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

// Block types for parsing
type BlockType = 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'math' | 'hr' | 'table'

interface Block {
  id: string
  type: BlockType
  content: string
  startLine: number
  endLine: number
  isMultiline: boolean
  language?: string // For code blocks
}

// Parse content into blocks
function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let i = 0
  let blockId = 0

  while (i < lines.length) {
    const line = lines[i]
    const startLine = i

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      let endLine = i + 1
      while (endLine < lines.length && !lines[endLine].startsWith('```')) {
        endLine++
      }
      const blockContent = lines.slice(i, endLine + 1).join('\n')
      blocks.push({
        id: `block-${blockId++}`,
        type: 'code',
        content: blockContent,
        startLine,
        endLine,
        isMultiline: true,
        language
      })
      i = endLine + 1
      continue
    }

    // Block math
    if (line.trim() === '$$') {
      let endLine = i + 1
      while (endLine < lines.length && lines[endLine].trim() !== '$$') {
        endLine++
      }
      const blockContent = lines.slice(i, endLine + 1).join('\n')
      blocks.push({
        id: `block-${blockId++}`,
        type: 'math',
        content: blockContent,
        startLine,
        endLine,
        isMultiline: true
      })
      i = endLine + 1
      continue
    }

    // Heading
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'heading',
        content: line,
        startLine,
        endLine: i,
        isMultiline: false
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'hr',
        content: line,
        startLine,
        endLine: i,
        isMultiline: false
      })
      i++
      continue
    }

    // List - group consecutive list items
    if (/^(\s*)[-*+]\s/.test(line) || /^(\s*)\d+\.\s/.test(line)) {
      let endLine = i + 1
      while (endLine < lines.length) {
        const nextLine = lines[endLine]
        if (/^(\s*)[-*+]\s/.test(nextLine) || /^(\s*)\d+\.\s/.test(nextLine)) {
          endLine++
        }
        else if (nextLine.startsWith('  ') && nextLine.trim() !== '') {
          endLine++
        }
        else if (nextLine.trim() === '' && endLine + 1 < lines.length && (/^(\s*)[-*+]\s/.test(lines[endLine + 1]) || /^(\s*)\d+\.\s/.test(lines[endLine + 1]))) {
          endLine++
        }
        else {
          break
        }
      }
      const blockContent = lines.slice(i, endLine).join('\n')
      blocks.push({
        id: `block-${blockId++}`,
        type: 'list',
        content: blockContent,
        startLine,
        endLine: endLine - 1,
        isMultiline: endLine - i > 1
      })
      i = endLine
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'blockquote',
        content: line,
        startLine,
        endLine: i,
        isMultiline: false
      })
      i++
      continue
    }

    // Table (simple detection)
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && /^\|?[\s-:|]+\|?$/.test(lines[i + 1])) {
      let endLine = i + 1
      while (endLine < lines.length && lines[endLine].includes('|')) {
        endLine++
      }
      const blockContent = lines.slice(i, endLine).join('\n')
      blocks.push({
        id: `block-${blockId++}`,
        type: 'table',
        content: blockContent,
        startLine,
        endLine: endLine - 1,
        isMultiline: true
      })
      i = endLine
      continue
    }

    // Empty line
    if (line.trim() === '') {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'paragraph',
        content: '',
        startLine,
        endLine: i,
        isMultiline: false
      })
      i++
      continue
    }

    // Paragraph
    blocks.push({
      id: `block-${blockId++}`,
      type: 'paragraph',
      content: line,
      startLine,
      endLine: i,
      isMultiline: false
    })
    i++
  }

  return blocks
}

// Wiki link regex - requires file extension like .md, .txt, etc.
const WIKI_LINK_REGEX = /\[\[([^\]\.]+\.[^\]]+)\]\]/g

// Check if a string is a valid wiki link with extension
function isValidWikiLink(text: string): { name: string; extension: string } | null {
  const match = text.match(/^\[\[([^\]\.]+)(\.[^\]]+)\]\]$/)
  if (match) {
    return { name: match[1], extension: match[2] }
  }
  return null
}

// Markdown components
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
          <code 
            className={`px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'text-primary' : 'bg-muted'}`}
            {...props}
          >
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
          customStyle={{ 
            margin: 0, 
            padding: '0.75rem', 
            fontSize: '0.8rem',
            backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
            border: 'none',
            boxShadow: 'none'
          }}
          codeTagProps={{
            style: {
              backgroundColor: 'transparent'
            }
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      )
    },
    // Wiki link component [[filename.md]]
    a: ({ href, children, ...props }: React.HTMLAttributes<HTMLAnchorElement>) => {
      // Check if it's a wiki link
      if (href?.startsWith('wiki://')) {
        const targetName = href.replace('wiki://', '')
        const linkInfo = isValidWikiLink(`[[${targetName}]]`)
        
        if (linkInfo) {
          return (
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors border border-primary/20"
              onClick={() => onWikiLinkClick?.(targetName)}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{linkInfo.name}</span>
              <span className="text-xs opacity-60">{linkInfo.extension}</span>
            </span>
          )
        }
        // Invalid format (no extension) - show as plain text with warning style
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
            <span className="opacity-60">[[</span>
            {targetName}
            <span className="opacity-60">]]</span>
          </span>
        )
      }
      
      // Check if it's a wiki link in children
      if (typeof children === 'string' && children.startsWith('[[')) {
        const linkInfo = isValidWikiLink(children)
        if (linkInfo) {
          return (
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors border border-primary/20"
              onClick={() => onWikiLinkClick?.(children.slice(2, -2))}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{linkInfo.name}</span>
              <span className="text-xs opacity-60">{linkInfo.extension}</span>
            </span>
          )
        }
        // Invalid format
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
            <span className="opacity-60">[[</span>
            {children.slice(2, -2)}
            <span className="opacity-60">]]</span>
          </span>
        )
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

// Custom plugin to render wiki links - requires file extension
function wikiLinkPlugin() {
  return (tree: any) => {
    // Walk through text nodes and convert [[link.md]] to links
    function walk(node: any) {
      if (node.type === 'text' && node.value) {
        // Only match wiki links with file extensions
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

// Simple inline block editor
function InlineBlockEditor({
  block,
  isActive,
  onActivate,
  onDeactivate,
  onContentChange,
  onKeyDown,
  isDark,
  onInput,
  onWikiLinkClick,
  resolveImageSrc,
}: {
  block: Block
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
  onContentChange: (blockId: string, newContent: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => void
  isDark: boolean
  onInput?: (e: React.ChangeEvent<HTMLTextAreaElement>, blockId: string) => void
  onWikiLinkClick?: (name: string) => void
  resolveImageSrc?: (src?: string) => string | undefined
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isActiveRef = useRef(isActive)
  const onDeactivateRef = useRef(onDeactivate)
  
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  useEffect(() => {
    onDeactivateRef.current = onDeactivate
  }, [onDeactivate])

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isActive])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Call slash command handler first
    onInput?.(e, block.id)
    onContentChange(block.id, e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }, [block.id, onContentChange, onInput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(e, block)
  }, [onKeyDown, block])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isActive) {
      onActivate()
    }
  }, [isActive, onActivate])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    
    setTimeout(() => {
      if (relatedTarget && (
        relatedTarget.tagName === 'BUTTON' ||
        relatedTarget.tagName === 'INPUT' ||
        relatedTarget.closest('header') ||
        relatedTarget.closest('[role="menu"]') ||
        relatedTarget.closest('[role="dialog"]')
      )) {
        return
      }
      
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'BUTTON' ||
        activeElement.tagName === 'INPUT' ||
        activeElement.closest('header') ||
        activeElement.closest('[role="menu"]') ||
        activeElement.closest('[role="dialog"]')
      )) {
        return
      }
      
      if (isActiveRef.current) {
        onDeactivateRef.current()
      }
    }, 100)
  }, [])

  const lineCount = Math.max(1, (block.content || '').split('\n').length)

  if (!isActive) {
    return (
      <div 
        className="min-h-[1.5em] py-0.5 cursor-text rounded"
        onClick={handleClick}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
            rehypePlugins={[rehypeKatex]}
            components={createMarkdownComponents(isDark, onWikiLinkClick, resolveImageSrc)}
          >
            {block.content || '\u00A0'}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      value={block.content}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      className="w-full bg-transparent border-none resize-none outline-none leading-[1.75] text-base py-0.5"
      spellCheck={false}
      autoFocus
      rows={lineCount}
    />
  )
}

// Special block editor for code/math/table/mermaid
function SpecialBlockEditor({
  block,
  isActive,
  onActivate,
  onDeactivate,
  onContentChange,
  onKeyDown,
  isDark,
  onWikiLinkClick,
  resolveImageSrc,
}: {
  block: Block
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
  onContentChange: (blockId: string, newContent: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => void
  isDark: boolean
  onWikiLinkClick?: (name: string) => void
  resolveImageSrc?: (src?: string) => string | undefined
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isActiveRef = useRef(isActive)
  const onDeactivateRef = useRef(onDeactivate)
  
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  useEffect(() => {
    onDeactivateRef.current = onDeactivate
  }, [onDeactivate])

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(block.id, e.target.value)
  }, [block.id, onContentChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(e, block)
  }, [onKeyDown, block])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isActive) {
      onActivate()
    }
  }, [isActive, onActivate])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    
    setTimeout(() => {
      if (relatedTarget && (
        relatedTarget.tagName === 'BUTTON' ||
        relatedTarget.tagName === 'INPUT' ||
        relatedTarget.closest('header') ||
        relatedTarget.closest('[role="menu"]') ||
        relatedTarget.closest('[role="dialog"]')
      )) {
        return
      }
      
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'BUTTON' ||
        activeElement.tagName === 'INPUT' ||
        activeElement.closest('header') ||
        activeElement.closest('[role="menu"]') ||
        activeElement.closest('[role="dialog"]')
      )) {
        return
      }
      
      if (isActiveRef.current) {
        onDeactivateRef.current()
      }
    }, 100)
  }, [])

  const lineCount = Math.max(3, (block.content || '').split('\n').length)

  // Get block type label
  const getBlockLabel = (type: BlockType, language?: string) => {
    if (type === 'code') {
      if (language === 'mermaid') return 'Mermaid'
      return language || 'Code'
    }
    switch (type) {
      case 'math': return 'Math'
      case 'table': return 'Table'
      default: return 'Block'
    }
  }

  const blockLabel = getBlockLabel(block.type, block.language)
  const isMermaid = block.type === 'code' && block.language === 'mermaid'

  // Extract code content (remove ``` markers)
  const getCodeContent = (content: string) => {
    const lines = content.split('\n')
    if (lines.length > 2 && lines[0].startsWith('```') && lines[lines.length - 1].startsWith('```')) {
      return lines.slice(1, -1).join('\n')
    }
    return content
  }

  if (!isActive) {
    // Render Mermaid diagrams
    if (isMermaid) {
      const mermaidCode = getCodeContent(block.content)
      return (
        <div 
          className="my-3 cursor-text rounded-lg"
          onClick={handleClick}
        >
          <MermaidRenderer code={mermaidCode} isDark={isDark} />
        </div>
      )
    }
    
    // Render as preview - NO border, just content
    return (
      <div 
        className="my-3 cursor-text rounded-lg"
        onClick={handleClick}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
            rehypePlugins={[rehypeKatex]}
            components={createMarkdownComponents(isDark, onWikiLinkClick, resolveImageSrc)}
          >
            {block.content || '\u00A0'}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  // Render as editor with beautiful styling
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-primary/30 bg-muted/10 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground border-b border-border/50">
        <span className="font-medium">{blockLabel}</span>
        <span className="ml-auto opacity-50 text-[10px]">Esc to finish</span>
      </div>
      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        className="w-full bg-transparent resize-none outline-none leading-[1.6] text-sm font-mono p-3 min-h-[80px]"
        spellCheck={false}
        autoFocus
        rows={lineCount}
      />
    </div>
  )
}

export const TyporaEditor = forwardRef<TyporaEditorRef, TyporaEditorProps>(
  function TyporaEditor({ content, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [activeBlockId, setActiveBlockId] = React.useState<string | null>(null)
    const [isDark, setIsDark] = React.useState(false)
    const focusMode = useEditorStore((state) => state.focusMode)
    const theme = useEditorStore((state) => state.theme)
    const t = useEditorStore((state) => state.t)
    const files = useEditorStore((state) => state.files)
    const currentFile = useEditorStore((state) => state.currentFile)
    const setCurrentFile = useEditorStore((state) => state.setCurrentFile)
    const setContent = useEditorStore((state) => state.setContent)

    // Update dark mode state when theme changes
    React.useEffect(() => {
      const updateDarkMode = () => {
        if (theme === 'dark') {
          setIsDark(true)
        } else if (theme === 'light') {
          setIsDark(false)
        } else {
          setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
      }
      
      updateDarkMode()
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        if (theme === 'system') {
          setIsDark(mediaQuery.matches)
        }
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }, [theme])

    // Parse blocks
    const blocks = useMemo(() => parseBlocks(content), [content])

    // Handle block content change
    const handleBlockContentChange = useCallback((blockId: string, newBlockContent: string) => {
      const block = blocks.find(b => b.id === blockId)
      if (!block) return

      const lines = content.split('\n')
      const blockLines = newBlockContent.split('\n')
      
      const newLines = [...lines]
      newLines.splice(block.startLine, block.endLine - block.startLine + 1, ...blockLines)
      onChange(newLines.join('\n'))
    }, [blocks, content, onChange])

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      getTextarea: () => containerRef.current?.querySelector('textarea'),
      focus: () => {
        const textarea = containerRef.current?.querySelector('textarea')
        textarea?.focus()
      },
      insertAtCursor: (before: string, after: string = '') => {
        const textarea = containerRef.current?.querySelector('textarea')
        
        if (textarea && activeBlockId) {
          const block = blocks.find(b => b.id === activeBlockId)
          if (block) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const blockContent = textarea.value
            const selectedText = blockContent.substring(start, end)
            
            let newBlockContent: string
            let newCursorStart: number
            let newCursorEnd: number
            
            if (selectedText.length > 0) {
              const isWrapped = selectedText.startsWith(before) && selectedText.endsWith(after) && 
                               selectedText.length >= before.length + after.length
              
              if (isWrapped) {
                const unwrappedText = selectedText.slice(before.length, selectedText.length - after.length)
                newBlockContent = blockContent.substring(0, start) + unwrappedText + blockContent.substring(end)
                newCursorStart = start
                newCursorEnd = start + unwrappedText.length
              } else {
                newBlockContent = blockContent.substring(0, start) + before + selectedText + after + blockContent.substring(end)
                newCursorStart = start + before.length
                newCursorEnd = start + before.length + selectedText.length
              }
            } else {
              newBlockContent = blockContent.substring(0, start) + before + after + blockContent.substring(end)
              newCursorStart = start + before.length
              newCursorEnd = start + before.length
            }
            
            handleBlockContentChange(block.id, newBlockContent)
            
            requestAnimationFrame(() => {
              textarea.focus()
              textarea.selectionStart = newCursorStart
              textarea.selectionEnd = newCursorEnd
            })
            return
          }
        }
        
        if (blocks.length > 0) {
          const lastBlock = blocks[blocks.length - 1]
          const newBlockContent = lastBlock.content + before + after
          handleBlockContentChange(lastBlock.id, newBlockContent)
          setActiveBlockId(lastBlock.id)
          
          requestAnimationFrame(() => {
            const newTextarea = containerRef.current?.querySelector('textarea')
            if (newTextarea) {
              newTextarea.focus()
              const cursorPos = lastBlock.content.length + before.length
              newTextarea.selectionStart = newTextarea.selectionEnd = cursorPos
            }
          })
        } else {
          onChange(before + after)
          setTimeout(() => setActiveBlockId('block-0'), 0)
        }
      }
    }), [activeBlockId, blocks, content, onChange, handleBlockContentChange])

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
      const lines = content.split('\n')
      
      if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code' && block.type !== 'math' && block.type !== 'table') {
        e.preventDefault()
        const newLines = [...lines]
        newLines.splice(block.endLine + 1, 0, '')
        onChange(newLines.join('\n'))
        
        setTimeout(() => {
          const newBlocks = parseBlocks(newLines.join('\n'))
          const nextBlock = newBlocks.find(b => b.startLine === block.endLine + 1)
          if (nextBlock) {
            setActiveBlockId(nextBlock.id)
          }
        }, 0)
      }
      
      if (e.key === 'Backspace' && e.currentTarget.value === '' && blocks.length > 1) {
        e.preventDefault()
        const newLines = lines.filter((_, i) => i < block.startLine || i > block.endLine)
        onChange(newLines.join('\n'))
        
        setTimeout(() => {
          const newBlocks = parseBlocks(newLines.join('\n'))
          const prevBlock = newBlocks.find(b => b.endLine === block.startLine - 1)
          if (prevBlock) {
            setActiveBlockId(prevBlock.id)
          }
        }, 0)
      }
      
      if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
        const prevBlock = blocks.find(b => b.endLine === block.startLine - 1)
        if (prevBlock) {
          e.preventDefault()
          setActiveBlockId(prevBlock.id)
        }
      }
      
      if (e.key === 'ArrowDown' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
        const nextBlock = blocks.find(b => b.startLine === block.endLine + 1)
        if (nextBlock) {
          e.preventDefault()
          setActiveBlockId(nextBlock.id)
        }
      }
      
      if (e.key === 'Tab') {
        e.preventDefault()
        const start = e.currentTarget.selectionStart
        const end = e.currentTarget.selectionEnd
        const value = e.currentTarget.value
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        
        handleBlockContentChange(block.id, newValue)
        
        const textarea = e.currentTarget
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        })
      }
      
      if (e.key === 'Escape') {
        e.currentTarget.blur()
        setActiveBlockId(null)
      }
    }, [content, blocks, onChange, handleBlockContentChange])

    // Handle special block key down
    const handleSpecialKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
      const lines = content.split('\n')
      
      if (e.key === 'Backspace' && e.currentTarget.value === '' && blocks.length > 1) {
        e.preventDefault()
        const newLines = lines.filter((_, i) => i < block.startLine || i > block.endLine)
        onChange(newLines.join('\n'))
        
        setTimeout(() => {
          const newBlocks = parseBlocks(newLines.join('\n'))
          const prevBlock = newBlocks.find(b => b.endLine === block.startLine - 1)
          if (prevBlock) {
            setActiveBlockId(prevBlock.id)
          }
        }, 0)
      }
      
      if (e.key === 'Escape') {
        e.currentTarget.blur()
        setActiveBlockId(null)
      }
    }, [content, blocks, onChange])

    // Focus block when clicking empty area
    const handleContainerClick = useCallback((e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        if (blocks.length > 0) {
          const lastBlock = blocks[blocks.length - 1]
          setActiveBlockId(lastBlock.id)
        }
      }
    }, [blocks])

    // Block activation helpers
    const setActive = useCallback((blockId: string) => {
      setActiveBlockId(blockId)
    }, [])
    
    const setInactive = useCallback(() => {
      setActiveBlockId(null)
    }, [])

    // Slash command handling
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
    const [slashFilter, setSlashFilter] = useState('')
    const slashStartPos = useRef<number | null>(null)
    const slashBlockId = useRef<string | null>(null)
    
    // Handle slash command select
    const handleSlashSelect = useCallback((cmd: { insert: string }) => {
      // Close menu immediately for better UX
      setShowSlashMenu(false)
      
      const blockId = slashBlockId.current
      const startPos = slashStartPos.current
      
      // Clear refs
      slashStartPos.current = null
      slashBlockId.current = null
      
      if (!startPos || !blockId) {
        console.warn('Slash command: missing start position or block id')
        return
      }
      
      const block = blocks.find(b => b.id === blockId)
      if (!block) {
        console.warn('Slash command: block not found')
        return
      }
      
      // Get textarea value and position
      const textarea = containerRef.current?.querySelector('textarea')
      if (!textarea) {
        console.warn('Slash command: textarea not found')
        return
      }
      
      const pos = textarea.selectionStart
      const value = textarea.value
      
      // Remove the "/" and insert command
      const before = value.substring(0, startPos - 1)
      const after = value.substring(pos)
      const newValue = before + cmd.insert + after
      
      handleBlockContentChange(block.id, newValue)
      
      // Set cursor position after a short delay
      requestAnimationFrame(() => {
        const cursorPos = before.length + cmd.insert.length
        textarea.selectionStart = textarea.selectionEnd = cursorPos
        textarea.focus()
      })
    }, [blocks, handleBlockContentChange])
    
    // Handle input for slash detection
    const handleInputWithSlash = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>, blockId: string) => {
      const value = e.target.value
      const pos = e.target.selectionStart
      
      // Check for slash at start of line or after whitespace
      if (value[pos - 1] === '/') {
        const beforeCursor = value.substring(0, pos - 1)
        const lastNewline = beforeCursor.lastIndexOf('\n')
        const textOnLine = beforeCursor.substring(lastNewline + 1)
        
        if (textOnLine.trim() === '') {
          slashStartPos.current = pos
          slashBlockId.current = blockId
          setSlashFilter('')
          
          // Calculate position
          const rect = e.target.getBoundingClientRect()
          setSlashPosition({
            top: rect.bottom + 5,
            left: rect.left + (pos % 50) * 8
          })
          
          setShowSlashMenu(true)
        }
      } else if (showSlashMenu && slashStartPos.current !== null) {
        // Update filter
        const filterText = value.substring(slashStartPos.current, pos)
        if (filterText.includes(' ')) {
          setShowSlashMenu(false)
          slashStartPos.current = null
        } else {
          setSlashFilter(filterText)
        }
      }
    }, [showSlashMenu])

    // Wiki link click handler
    const handleWikiLinkClick = useCallback((targetName: string) => {
      // Find file by name (with or without extension)
      const findFile = (nodes: typeof files, name: string): typeof files[0] | null => {
        // Extract name without extension for comparison
        const nameWithoutExt = name.replace(/\.[^.]+$/, '').toLowerCase()
        const nameWithExt = name.toLowerCase()
        
        for (const node of nodes) {
          if (node.type === 'file') {
            const nodeFullName = node.name.toLowerCase()
            const nodeNameWithoutExt = node.name.replace(/\.[^.]+$/, '').toLowerCase()
            
            // Match by full name with extension or just name
            if (nodeFullName === nameWithExt || nodeNameWithoutExt === nameWithoutExt) {
              return node
            }
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
    }, [files, setCurrentFile, setContent])

    const resolveImageSrc = useCallback((src?: string) => {
      if (!src || !currentFile?.path) return src
      if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src

      const currentParts = currentFile.path.split('/').filter(Boolean)
      currentParts.pop()

      const relativeParts = src.split('/').filter(Boolean)
      for (const part of relativeParts) {
        if (part === '.') continue
        if (part === '..') {
          currentParts.pop()
          continue
        }
        currentParts.push(part)
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
      if (imageNode?.fileType === 'image' && imageNode.blobUrl) {
        return imageNode.blobUrl
      }

      return src
    }, [currentFile, files])

    return (
      <div 
        ref={containerRef}
        className="editor-scrollbar relative flex-1 h-full overflow-y-auto"
        onClick={handleContainerClick}
      >
        <div className={`min-h-full p-8 md:p-12 lg:p-16 ${focusMode ? 'max-w-4xl mx-auto' : ''}`}>
          {blocks.map((block) => {
            // Use special editor for code/math/table
            if (block.type === 'code' || block.type === 'math' || block.type === 'table') {
              return (
                <SpecialBlockEditor
                  key={block.id}
                  block={block}
                  isActive={activeBlockId === block.id}
                  onActivate={() => setActive(block.id)}
                  onDeactivate={setInactive}
                  onContentChange={handleBlockContentChange}
                  onKeyDown={handleSpecialKeyDown}
                  isDark={isDark}
                  onWikiLinkClick={handleWikiLinkClick}
                  resolveImageSrc={resolveImageSrc}
                />
              )
            }
            
            // Use inline editor for everything else
            return (
              <InlineBlockEditor
                key={block.id}
                block={block}
                isActive={activeBlockId === block.id}
                onActivate={() => setActive(block.id)}
                onDeactivate={setInactive}
                onContentChange={handleBlockContentChange}
                onKeyDown={handleKeyDown}
                isDark={isDark}
                onInput={handleInputWithSlash}
                onWikiLinkClick={handleWikiLinkClick}
                resolveImageSrc={resolveImageSrc}
              />
            )
          })}
          
          {/* Empty state */}
          {blocks.length === 0 && (
            <div 
              className="text-muted-foreground cursor-text py-1"
              onClick={() => onChange('\n')}
            >
              {t('clickToStart')}
            </div>
          )}
        </div>
        
        {/* Slash command menu */}
        <SlashMenu
          visible={showSlashMenu}
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
