export interface MarkdownBlock {
  startLine: number
  endLine: number
  content: string
}

function isFence(line: string): boolean {
  return /^\s*```/.test(line)
}

function isTableCandidate(line: string): boolean {
  return line.includes('|') && (line.match(/\|/g) || []).length >= 2
}

/**
 * Split Markdown into independently renderable blocks while preserving source
 * line ranges for MarkFlow's click-to-edit interaction.
 *
 * This is deliberately a lightweight source partitioner, not a Markdown AST
 * parser. ReactMarkdown remains the source of truth for Markdown semantics.
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (isFence(line)) {
      const startLine = index
      index += 1

      while (index < lines.length && !isFence(lines[index])) {
        index += 1
      }
      if (index < lines.length) index += 1

      blocks.push({
        startLine,
        endLine: index - 1,
        content: lines.slice(startLine, index).join('\n'),
      })
      continue
    }

    if (line.trim() === '$$') {
      const startLine = index
      index += 1

      while (index < lines.length && lines[index].trim() !== '$$') {
        index += 1
      }
      if (index < lines.length) index += 1

      blocks.push({
        startLine,
        endLine: index - 1,
        content: lines.slice(startLine, index).join('\n'),
      })
      continue
    }

    if (isTableCandidate(line)) {
      const startLine = index
      while (index < lines.length && isTableCandidate(lines[index])) {
        index += 1
      }

      blocks.push({
        startLine,
        endLine: index - 1,
        content: lines.slice(startLine, index).join('\n'),
      })
      continue
    }

    blocks.push({ startLine: index, endLine: index, content: line })
    index += 1
  }

  return blocks
}
