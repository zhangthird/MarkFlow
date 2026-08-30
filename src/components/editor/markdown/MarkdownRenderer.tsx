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
          if (start > lastIndex) {
            parts.push({ type: 'text', value: node.value.slice(lastIndex, start) })
          }

          parts.push({
            type: 'link',
            url: `wiki://${encodeURIComponent(target)}`,
            children: [{
              type: 'text',
              value: match[2]?.trim() || target,
            }],
            data: { wikiLink: true },
          })
          lastIndex = start + match[0].length
        }

        if (parts.length > 0) {
          if (lastIndex < node.value.length) {
            parts.push({ type: 'text', value: node.value.slice(lastIndex) })
          }
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
  resolveImageSrc?: (src?: string) => string | undefined
}

export function MarkdownRenderer({
  content,
  isDark,
  onWikiLinkClick,
  resolveImageSrc,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code: ({ className, children, ...props }) => {
          const languageMatch = /language-([\w-]+)/.exec(className || '')
          const language = languageMatch?.[1]
          const codeString = String(children).replace(/\n$/, '')
          const isInline = !languageMatch && !codeString.includes('\n')

          if (language === 'mermaid') {
            return <MermaidRenderer code={codeString} isDark={isDark} />
          }

          if (isInline) {
            return (
              <code
                className={`rounded px-1.5 py-0.5 font-mono text-sm ${isDark ? 'text-primary' : 'bg-muted'}`}
                {...props}
              >
                {children}
              </code>
            )
          }

          return (
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={language || 'text'}
              PreTag="div"
              className="rounded-lg"
              customStyle={{
                margin: 0,
                padding: '0.75rem',
                fontSize: '0.8rem',
                border: 'none',
                boxShadow: 'none',
              }}
              codeTagProps={{ style: { backgroundColor: 'transparent' } }}
            >
              {codeString}
            </SyntaxHighlighter>
          )
        },
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('wiki://')) {
            const encodedTarget = href.slice('wiki://'.length)
            let target = encodedTarget
            try {
              target = decodeURIComponent(encodedTarget)
            } catch {
              // Keep the raw target if a manually authored value is malformed.
            }

            return (
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                onClick={(event) => {
                  event.stopPropagation()
                  onWikiLinkClick?.(target)
                }}
              >
                {children}
              </button>
            )
          }

          return <a href={href} {...props}>{children}</a>
        },
        img: ({ src, alt }) => {
          const resolvedSrc = resolveImageSrc?.(typeof src === 'string' ? src : undefined) || src
          if (typeof resolvedSrc !== 'string' || !resolvedSrc) return null

          return (
            <img
              src={resolvedSrc}
              alt={alt || 'image'}
              className="my-3 max-h-[60vh] w-auto max-w-full rounded-lg border border-border/60 bg-background object-contain shadow-sm"
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
