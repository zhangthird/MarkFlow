export type MarkdownBlockKind =
  | 'blank'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'blockquote'
  | 'table'
  | 'code'
  | 'math'
  | 'thematic-break'

export interface MarkdownBlock {
  startLine: number
  endLine: number
  content: string
  kind: MarkdownBlockKind
}

function isFence(line: string): boolean {
  return /^\s*(`{3,}|~{3,})/.test(line)
}

function fenceMarker(line: string): string | null {
  return line.match(/^\s*(`{3,}|~{3,})/)?.[1] ?? null
}

function isFenceClose(line: string, openingMarker: string): boolean {
  const markerChar = openingMarker[0]
  const minimumLength = openingMarker.length
  const match = line.match(new RegExp(`^\\s*(${markerChar === '`' ? '`' : '~'}{${minimumLength},})\\s*$`))
  return Boolean(match)
}

function isHeading(line: string): boolean {
  return /^\s{0,3}#{1,6}(?:\s+|$)/.test(line)
}

function isBlockquote(line: string): boolean {
  return /^\s{0,3}>/.test(line)
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-+*]|\d+[.)])\s+/.test(line)
}

function isThematicBreak(line: string): boolean {
  const trimmed = line.trim()
  return /^(?:\*\s*){3,}$/.test(trimmed) || /^(?:-\s*){3,}$/.test(trimmed) || /^(?:_\s*){3,}$/.test(trimmed)
}

function isTableRow(line: string): boolean {
  return line.includes('|') && (line.match(/\|/g) || []).length >= 2
}

function isTableDivider(line: string): boolean {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|')
  return cells.length >= 2 && cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))
}

function isTableStart(lines: string[], index: number): boolean {
  return index + 1 < lines.length && isTableRow(lines[index]) && isTableDivider(lines[index + 1])
}

function isHardBlockStart(lines: string[], index: number): boolean {
  const line = lines[index]
  return line.trim() === '' ||
    isFence(line) ||
    line.trim() === '$$' ||
    isHeading(line) ||
    isBlockquote(line) ||
    isListItem(line) ||
    isThematicBreak(line) ||
    isTableStart(lines, index)
}

function pushBlock(
  blocks: MarkdownBlock[],
  lines: string[],
  startLine: number,
  endExclusive: number,
  kind: MarkdownBlockKind
) {
  blocks.push({
    startLine,
    endLine: Math.max(startLine, endExclusive - 1),
    content: lines.slice(startLine, endExclusive).join('\n'),
    kind,
  })
}

/**
 * Split source into Typora-style editable blocks. Each block remains a complete
 * Markdown fragment so ReactMarkdown can preserve paragraph, list, table and
 * quote semantics while MarkFlow exposes source only for the active block.
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      pushBlock(blocks, lines, index, index + 1, 'blank')
      index += 1
      continue
    }

    const openingFence = fenceMarker(line)
    if (openingFence) {
      const startLine = index
      index += 1
      while (index < lines.length && !isFenceClose(lines[index], openingFence)) index += 1
      if (index < lines.length) index += 1
      pushBlock(blocks, lines, startLine, index, 'code')
      continue
    }

    if (line.trim() === '$$') {
      const startLine = index
      index += 1
      while (index < lines.length && lines[index].trim() !== '$$') index += 1
      if (index < lines.length) index += 1
      pushBlock(blocks, lines, startLine, index, 'math')
      continue
    }

    if (isTableStart(lines, index)) {
      const startLine = index
      index += 2
      while (index < lines.length && isTableRow(lines[index]) && lines[index].trim() !== '') index += 1
      pushBlock(blocks, lines, startLine, index, 'table')
      continue
    }

    if (isHeading(line)) {
      pushBlock(blocks, lines, index, index + 1, 'heading')
      index += 1
      continue
    }

    if (isThematicBreak(line)) {
      pushBlock(blocks, lines, index, index + 1, 'thematic-break')
      index += 1
      continue
    }

    if (isBlockquote(line)) {
      const startLine = index
      index += 1
      while (index < lines.length && lines[index].trim() !== '') {
        if (isFence(lines[index]) || lines[index].trim() === '$$' || isTableStart(lines, index)) break
        index += 1
      }
      pushBlock(blocks, lines, startLine, index, 'blockquote')
      continue
    }

    if (isListItem(line)) {
      const startLine = index
      index += 1
      while (index < lines.length && lines[index].trim() !== '') {
        if (isFence(lines[index]) || lines[index].trim() === '$$' || isHeading(lines[index]) || isTableStart(lines, index)) break
        index += 1
      }
      pushBlock(blocks, lines, startLine, index, 'list')
      continue
    }

    const startLine = index
    index += 1
    while (index < lines.length && !isHardBlockStart(lines, index)) index += 1
    pushBlock(blocks, lines, startLine, index, 'paragraph')
  }

  return blocks
}
