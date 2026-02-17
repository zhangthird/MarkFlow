'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Code, 
  List, 
  ListOrdered, 
  Quote, 
  Table, 
  Minus,
  Sigma,
  GitBranch,
  Image as ImageIcon,
  Link,
  CheckSquare,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Sparkles,
  Type,
  FileImage
} from 'lucide-react'

export interface SlashCommand {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  insert: string
  category: 'basic' | 'block' | 'media'
  shortcut?: string
  color: string
}

export const slashCommands: SlashCommand[] = [
  // Basic formatting
  { id: 'h1', label: 'Heading 1', description: 'Big section heading', icon: <Heading1 className="w-4 h-4" />, insert: '# ', category: 'basic', shortcut: '#', color: 'text-rose-500' },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: <Heading2 className="w-4 h-4" />, insert: '## ', category: 'basic', shortcut: '##', color: 'text-orange-500' },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', icon: <Heading3 className="w-4 h-4" />, insert: '### ', category: 'basic', shortcut: '###', color: 'text-amber-500' },
  { id: 'bullet', label: 'Bullet List', description: 'Create a simple bullet list', icon: <List className="w-4 h-4" />, insert: '- ', category: 'basic', shortcut: '-', color: 'text-emerald-500' },
  { id: 'numbered', label: 'Numbered List', description: 'Create a numbered list', icon: <ListOrdered className="w-4 h-4" />, insert: '1. ', category: 'basic', shortcut: '1.', color: 'text-teal-500' },
  { id: 'todo', label: 'Todo List', description: 'Track tasks with checkboxes', icon: <CheckSquare className="w-4 h-4" />, insert: '- [ ] ', category: 'basic', shortcut: '[]', color: 'text-cyan-500' },
  { id: 'quote', label: 'Quote', description: 'Insert a blockquote', icon: <Quote className="w-4 h-4" />, insert: '> ', category: 'basic', shortcut: '>', color: 'text-violet-500' },
  { id: 'divider', label: 'Divider', description: 'Visual separator line', icon: <Minus className="w-4 h-4" />, insert: '\n---\n', category: 'basic', shortcut: '---', color: 'text-slate-500' },
  
  // Block elements
  { id: 'code', label: 'Code Block', description: 'Code with syntax highlighting', icon: <Code className="w-4 h-4" />, insert: '\n```\ncode here\n```\n', category: 'block', shortcut: '```', color: 'text-sky-500' },
  { id: 'math', label: 'Formula Block', description: 'LaTeX mathematical formula', icon: <Sigma className="w-4 h-4" />, insert: '\n$$\nE = mc^2\n$$\n', category: 'block', shortcut: '$$', color: 'text-fuchsia-500' },
  { id: 'table', label: 'Table', description: 'Insert a data table', icon: <Table className="w-4 h-4" />, insert: '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n', category: 'block', shortcut: '|', color: 'text-indigo-500' },
  { id: 'mermaid', label: 'Mermaid Diagram', description: 'Flowcharts, sequences, gantt', icon: <GitBranch className="w-4 h-4" />, insert: '\n```mermaid\ngraph TD\n    A[Start] --> B[Process]\n    B --> C[End]\n```\n', category: 'block', shortcut: 'mermaid', color: 'text-purple-500' },
  
  // Media
  { id: 'link', label: 'Link', description: 'Insert a hyperlink', icon: <Link className="w-4 h-4" />, insert: '[text](url)', category: 'media', shortcut: '[]()', color: 'text-blue-500' },
  { id: 'image', label: 'Image', description: 'Insert an image', icon: <ImageIcon className="w-4 h-4" />, insert: '![alt](url)', category: 'media', shortcut: '![]()', color: 'text-green-500' },
  { id: 'wikilink', label: 'Wiki Link', description: 'Link to another file', icon: <FileText className="w-4 h-4" />, insert: '[[filename.md]]', category: 'media', shortcut: '[[]]', color: 'text-pink-500' },
]

interface SlashMenuProps {
  visible: boolean
  position: { top: number; left: number }
  filter: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

// Category icons and labels
const categoryConfig = {
  basic: { 
    label: 'Basic', 
    icon: <Type className="w-3 h-3" />
  },
  block: { 
    label: 'Blocks', 
    icon: <Sparkles className="w-3 h-3" />
  },
  media: { 
    label: 'Media', 
    icon: <FileImage className="w-3 h-3" />
  }
}

export function SlashMenu({ visible, position, filter, onSelect, onClose }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Filter commands
  const filteredCommands = React.useMemo(() => {
    if (!filter) return slashCommands
    const lowerFilter = filter.toLowerCase()
    return slashCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerFilter) ||
      cmd.description.toLowerCase().includes(lowerFilter) ||
      cmd.id.toLowerCase().includes(lowerFilter) ||
      cmd.shortcut?.toLowerCase().includes(lowerFilter)
    )
  }, [filter])
  
  // Reset selection when filter changes - use derived state
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1))
  const effectiveSelectedIndex = selectedIndex >= filteredCommands.length ? 0 : safeSelectedIndex
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (filteredCommands[effectiveSelectedIndex]) {
            onSelect(filteredCommands[effectiveSelectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            setSelectedIndex(i => Math.max(i - 1, 0))
          } else {
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
          }
          break
      }
    }
    
    // Don't use capture phase to avoid intercepting textarea events
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, effectiveSelectedIndex, filteredCommands, onSelect, onClose])
  
  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedEl = menuRef.current.querySelector(`[data-index="${effectiveSelectedIndex}"]`)
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [effectiveSelectedIndex])
  
  // Close on click outside
  useEffect(() => {
    if (!visible) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    // Use setTimeout to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, onClose])
  
  // Handle command click
  const handleCommandClick = useCallback((cmd: SlashCommand, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(cmd)
  }, [onSelect])
  
  if (!visible || filteredCommands.length === 0) return null
  
  // Group by category
  const categories = ['basic', 'block', 'media'] as const
  
  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-72 overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ top: position.top, left: position.left }}
    >
      {/* Commands list with custom scrollbar */}
      <div className="slash-menu-scroll max-h-[300px] overflow-y-auto py-1">
        {categories.map(category => {
          const commands = filteredCommands.filter(c => c.category === category)
          if (commands.length === 0) return null
          
          const config = categoryConfig[category]
          
          return (
            <div key={category} className="mb-1">
              {/* Category header */}
              <div className="mx-2 mb-1 flex items-center gap-1.5 px-2 py-1">
                <span className="text-muted-foreground">{config.icon}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {config.label}
                </span>
              </div>
              
              {/* Commands */}
              {commands.map((cmd) => {
                const globalIndex = filteredCommands.indexOf(cmd)
                const isSelected = globalIndex === effectiveSelectedIndex
                
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-index={globalIndex}
                    className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors select-none ${
                      isSelected 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={(e) => handleCommandClick(cmd, e)}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    {/* Icon with color */}
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                      isSelected 
                        ? 'bg-background/70' 
                        : 'bg-muted/50'
                    }`}>
                      <span className={cmd.color}>{cmd.icon}</span>
                    </div>
                    
                    {/* Label and description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {cmd.label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cmd.description}
                      </div>
                    </div>
                    
                    {/* Shortcut badge */}
                    {cmd.shortcut && (
                      <div className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                        isSelected 
                          ? 'bg-background/80 text-foreground' 
                          : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {cmd.shortcut}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      
      {/* Footer with keyboard hints */}
      <div className="border-t border-border px-3 py-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">↓</kbd>
              <span className="ml-1">Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">↵</kbd>
              <span className="ml-1">Select</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono text-[9px]">Esc</kbd>
            <span className="ml-1">Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
