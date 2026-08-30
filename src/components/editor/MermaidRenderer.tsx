'use client'

import React, { useEffect, useId, useState } from 'react'

interface MermaidRendererProps {
  code: string
  isDark: boolean
}

const MERMAID_MAX_TEXT_SIZE = 50_000
const MERMAID_MAX_EDGES = 500

export function MermaidRenderer({ code, isDark }: MermaidRendererProps) {
  const reactId = useId()
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let active = true

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default

        // MarkFlow can open arbitrary local Markdown workspaces. Keep Mermaid in
        // its strict trust mode so diagram text cannot opt into HTML/callback
        // behavior, and retain explicit complexity limits for defensive rendering.
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
          maxTextSize: MERMAID_MAX_TEXT_SIZE,
          maxEdges: MERMAID_MAX_EDGES,
          suppressErrorRendering: true,
        })

        // React useId is stable for this component instance. Strip punctuation
        // so the identifier also remains safe for Mermaid/SVG selector usage.
        const diagramId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
        const result = await mermaid.render(diagramId, code)

        if (active) {
          setSvg(result.svg)
          setError(null)
        }
      } catch (renderError) {
        if (active) {
          setError(renderError instanceof Error ? renderError.message : 'Failed to render diagram')
          setSvg('')
        }
      }
    }

    void renderDiagram()

    return () => {
      active = false
    }
  }, [code, isDark, reactId])

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500" role="alert">
        <div className="mb-1 font-medium">Mermaid Error</div>
        <div className="break-words text-xs">{error}</div>
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        className="min-h-12 animate-pulse rounded-lg bg-muted/40"
        aria-label="Rendering Mermaid diagram"
      />
    )
  }

  return (
    <div
      className="mermaid-container overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function isMermaidBlock(code: string): boolean {
  const firstLine = code.split('\n')[0]?.trim()
  return firstLine === 'mermaid' || firstLine?.startsWith('mermaid ')
}
