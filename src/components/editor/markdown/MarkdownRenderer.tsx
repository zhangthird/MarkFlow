'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
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

interface MarkdownRendererProps {
  content: string
  isDark: boolean
  onWikiLinkClick?: (target: string) => void
  onTaskToggle?: (taskIndex: number, checked: boolean) => void
  resolveImageSrc?: (src?: string) => string | undefined
}

export function MarkdownRenderer({
  content,
  isDark,
  onWikiLinkClick,
  onTaskToggle,
  resolveImageSrc,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => {
          const languageMatch = /language-([\w-]+)/.exec(className || '')
          const language = languageMatch?.[1]
          const codeString = String(children).replace(/\n$/, '')
          const isInline = !languageMatch && !codeString.includes('\n')

          if (language === 'mermaid') {
            return (
              <div className="markflow-mermaid">
                <MermaidRenderer code={codeString} isDark={isDark} />
              </div>
            )
          }

          if (isInline) {
            return <code className="markflow-inline-code" {...props}>{children}</code>
          }

          return (
            <div className="markflow-code-block">
              {language && <div className="markflow-code-language">{language}</div>}
              <SyntaxHighlighter
                style={isDark ? oneDark : oneLight}
                language={language || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: language ? '2rem 1rem 1rem' : '1rem',
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
        input: ({ type, checked, ...props }) => {
          if (type !== 'checkbox') {
            return <input type={type} checked={checked} readOnly {...props} />
          }

          return (
            <input
              type="checkbox"
              checked={Boolean(checked)}
              disabled={!onTaskToggle}
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
              {...props}
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
