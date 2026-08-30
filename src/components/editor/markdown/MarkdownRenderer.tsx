'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { MermaidRenderer } from '../MermaidRenderer'

const WIKI_LINK_REGEX = /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g

function wikiLinkPlugin() {
  return (tree: any) => {
    function walk(node: any) {
      if (node.type === 'text' && node.value) {
        const parts: any[] = []
        let lastIndex = 0

        for (const match of node.value.matchAll(WIKI_LINK_REGEX)) {
          const target = match[1]?.trim()
          if (!target) continue
          const start = match.index ?? 0
          if (start > lastIndex) parts.push({ type: 'text', value: node.value.slice(lastIndex, start) })

          parts.push({
            type: 'link',
            url: `wiki://${encodeURIComponent(target)}`,
            children: [{ type: 'text', value: match[2]?.trim() || target }],
            data: { wikiLink: true },
          })
          lastIndex = start + match[0].length
        }

        if (parts.length > 0) {
          if (lastIndex < node.value.length) parts.push({ type: 'text', value: node.value.slice(lastIndex) })
          return parts
        }
      }

      if (node.children) {
        const nextChildren: any[] = []
        for (const child of node.children) {
          const result = walk(child)
          if (Array.isArray(result)) nextChildren.push(...result)
          else nextChildren.push(child)
        }
        node.children = nextChildren
      }

      return node
    }

    walk(tree)
  }
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy failed')
}

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await writeClipboard(text)
      setCopied(true)
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }

  return (
    <button
      type="button"
      className="markflow-code-copy"
      onMouseDown={event => event.preventDefault()}
      onClick={handleCopy}
      title={copied ? 'Copied' : 'Copy code'}
      aria-label={copied ? 'Code copied' : 'Copy code'}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

interface MarkdownRendererProps {
  content: string
  isDark: boolean
  onWikiLinkClick?: (target: string) => void
  onTaskToggle?: (taskIndex: number, checked: boolean) => void
  onTableCellClick?: (rowIndex: number, cellIndex: number) => void
  resolveImageSrc?: (src?: string) => string | undefined
}

export function MarkdownRenderer({
  content,
  isDark,
  onWikiLinkClick,
  onTaskToggle,
  onTableCellClick,
  resolveImageSrc,
}: MarkdownRendererProps) {
  const handleTableCellClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    if (!onTableCellClick) return
    event.stopPropagation()
    const row = event.currentTarget.parentElement as HTMLTableRowElement | null
    if (!row) return
    onTableCellClick(row.rowIndex, event.currentTarget.cellIndex)
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, node, ...props }) => {
          const languageMatch = /language-([\w-]+)/.exec(className || '')
          const language = languageMatch?.[1]
          const rawCode = String(children)
          const sourceSpansLines = Boolean(
            node?.position && node.position.start.line !== node.position.end.line
          )
          const isBlock = Boolean(languageMatch)
            || rawCode.endsWith('\n')
            || rawCode.includes('\n')
            || sourceSpansLines
          const codeString = rawCode.replace(/\n$/, '')

          if (language === 'mermaid') {
            return (
              <div className="markflow-mermaid">
                <div className="markflow-mermaid-toolbar">
                  <span className="markflow-code-language">mermaid</span>
                  <CopyCodeButton text={codeString} />
                </div>
                <MermaidRenderer code={codeString} isDark={isDark} />
              </div>
            )
          }

          if (!isBlock) {
            return <code className="markflow-inline-code" {...props}>{children}</code>
          }

          return (
            <div className="markflow-code-block">
              <div className="markflow-code-toolbar">
                {language && <span className="markflow-code-language">{language}</span>}
                <CopyCodeButton text={codeString} />
              </div>
              <SyntaxHighlighter
                style={isDark ? oneDark : oneLight}
                language={language || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: '2rem 1rem 1rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.65,
                  border: 'none',
                  borderRadius: '0.65rem',
                  boxShadow: 'none',
                  background: 'transparent',
                }}
                codeTagProps={{ style: { backgroundColor: 'transparent', fontFamily: 'var(--font-geist-mono), monospace' } }}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          )
        },
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('wiki://')) {
            const encodedTarget = href.slice('wiki://'.length)
            let target = encodedTarget
            try {
              target = decodeURIComponent(encodedTarget)
            } catch {
              // Keep malformed manually-authored values navigable as raw text.
            }

            return (
              <button
                type="button"
                className="markflow-wiki-link"
                onClick={event => {
                  event.stopPropagation()
                  onWikiLinkClick?.(target)
                }}
              >
                {children}
              </button>
            )
          }

          return (
            <a href={href} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} {...props}>
              {children}
            </a>
          )
        },
        table: ({ children }) => (
          <div className="markflow-table-wrap">
            <table>{children}</table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th {...props} onClick={handleTableCellClick}>{children}</th>
        ),
        td: ({ children, ...props }) => (
          <td {...props} onClick={handleTableCellClick}>{children}</td>
        ),
        input: ({ type, checked, ...props }) => {
          if (type !== 'checkbox') {
            return <input {...props} type={type} checked={checked} readOnly />
          }

          return (
            <input
              {...props}
              type="checkbox"
              checked={Boolean(checked)}
              disabled={!onTaskToggle}
              readOnly={!onTaskToggle}
              tabIndex={onTaskToggle ? 0 : -1}
              className="markflow-task-checkbox"
              aria-label={checked ? 'Mark task incomplete' : 'Mark task complete'}
              onClick={event => event.stopPropagation()}
              onChange={event => {
                event.stopPropagation()
                const block = event.currentTarget.closest('.markflow-block')
                const checkboxes = block
                  ? Array.from(block.querySelectorAll<HTMLInputElement>('.markflow-task-checkbox'))
                  : []
                const taskIndex = checkboxes.indexOf(event.currentTarget)
                if (taskIndex >= 0) onTaskToggle?.(taskIndex, event.currentTarget.checked)
              }}
            />
          )
        },
        img: ({ src, alt }) => {
          const resolvedSrc = resolveImageSrc?.(typeof src === 'string' ? src : undefined) || src
          if (typeof resolvedSrc !== 'string' || !resolvedSrc) return null

          return (
            <img
              src={resolvedSrc}
              alt={alt || 'image'}
              className="markflow-image"
              loading="lazy"
            />
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}