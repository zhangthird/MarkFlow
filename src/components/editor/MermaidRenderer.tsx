'use client'

import React, { useEffect, useRef, useState } from 'react'

interface MermaidRendererProps {
  code: string
  isDark: boolean
}

export function MermaidRenderer({ code, isDark }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string>('')
  
  useEffect(() => {
    let mounted = true
    
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        })
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg } = await mermaid.render(id, code)
        
        if (mounted) {
          setSvg(svg)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
          setSvg('')
        }
      }
    }
    
    renderDiagram()
    
    return () => {
      mounted = false
    }
  }, [code, isDark])
  
  if (error) {
    return (
      <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg">
        <div className="font-medium mb-1">Mermaid Error</div>
        <div className="text-xs">{error}</div>
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      className="mermaid-container overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// Parse mermaid code block
export function isMermaidBlock(code: string): boolean {
  const firstLine = code.split('\n')[0]?.trim()
  return firstLine === 'mermaid' || firstLine?.startsWith('mermaid ')
}
