import type { FileNode } from '@/store/editor-store'

export interface WikiLinkReference {
  sourcePath: string
  sourceName: string
  targetName: string
  alias?: string
  line: number
  context: string
}

export interface WikiLinkRewriteResult {
  content: string
  replacements: number
}

// Supports [[Note]], [[Note.md]], [[folder/Note]], and [[Note|display text]].
const WIKI_LINK_REGEX = /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g

export const normalizeWikiName = (name: string) => name.trim().replace(/\\/g, '/').toLowerCase()

export const normalizeWikiNameWithoutExt = (name: string) =>
  normalizeWikiName(name).replace(/\.[^./]+$/, '')

function withoutExtension(name: string): string {
  return name.replace(/\.[^./]+$/, '')
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

function normalizeWorkspacePath(path: string): string {
  const normalized = normalizeWikiName(path)
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function rewriteTargetSyntax(targetName: string, newPath: string, newName: string): string {
  const hasExplicitPath = targetName.replace(/\\/g, '/').includes('/')
  const keepsExtension = /\.[^./]+$/.test(targetName)

  if (hasExplicitPath) {
    const keepsLeadingSlash = targetName.startsWith('/')
    const path = keepsExtension ? newPath : withoutExtension(newPath)
    return keepsLeadingSlash ? path : path.replace(/^\//, '')
  }

  return keepsExtension ? newName : withoutExtension(newName)
}

export function extractWikiLinks(
  content: string,
  sourcePath: string,
  sourceName: string
): WikiLinkReference[] {
  const links: WikiLinkReference[] = []
  const lines = content.split('\n')

  for (const match of content.matchAll(WIKI_LINK_REGEX)) {
    const targetName = match[1]?.trim()
    if (!targetName) continue

    const position = match.index ?? 0
    const line = content.slice(0, position).split('\n').length

    links.push({
      sourcePath,
      sourceName,
      targetName,
      alias: match[2]?.trim() || undefined,
      line,
      context: lines[line - 1] || '',
    })
  }

  return links
}

export function collectWorkspaceFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []

  const visit = (items: FileNode[]) => {
    for (const node of items) {
      if (node.type === 'file') result.push(node)
      if (node.children) visit(node.children)
    }
  }

  visit(nodes)
  return result
}

export function resolveWikiLinkTarget(
  files: FileNode[],
  targetName: string,
  sourcePath?: string
): FileNode | null {
  const normalizedTarget = normalizeWikiName(targetName)
  const normalizedTargetWithoutExt = normalizeWikiNameWithoutExt(targetName)

  // Explicit paths such as [[folder/Note.md]] have priority.
  if (normalizedTarget.includes('/')) {
    const explicitPath = normalizeWorkspacePath(normalizedTarget)
    const explicitWithoutExt = normalizeWikiNameWithoutExt(explicitPath)
    return files.find(file => {
      const path = normalizeWorkspacePath(file.path)
      return path === explicitPath || normalizeWikiNameWithoutExt(path) === explicitWithoutExt
    }) ?? null
  }

  const candidates = files.filter(file => {
    const name = normalizeWikiName(file.name)
    return name === normalizedTarget || normalizeWikiNameWithoutExt(name) === normalizedTargetWithoutExt
  })

  if (candidates.length <= 1) return candidates[0] ?? null

  // If duplicate names exist, prefer a note next to the source note.
  if (sourcePath) {
    const sourceDirectory = normalizeWikiName(directoryOf(sourcePath))
    const sibling = candidates.find(file => normalizeWikiName(directoryOf(file.path)) === sourceDirectory)
    if (sibling) return sibling
  }

  return candidates[0]
}

/**
 * Rewrite only Wiki links that currently resolve to the renamed file.
 *
 * This deliberately avoids a global string replacement. Resolution happens
 * against the pre-rename workspace, so duplicate note names and same-directory
 * preference follow exactly the same rules as normal Wiki-link navigation.
 */
export function rewriteWikiLinksForFileRename(
  content: string,
  sourcePath: string,
  workspaceFiles: FileNode[],
  oldTargetPath: string,
  newTargetPath: string,
  newTargetName: string
): WikiLinkRewriteResult {
  let cursor = 0
  let replacements = 0
  let rewritten = ''

  for (const match of content.matchAll(WIKI_LINK_REGEX)) {
    const matchIndex = match.index ?? 0
    const rawTarget = match[1] ?? ''
    const targetName = rawTarget.trim()
    if (!targetName) continue

    const resolved = resolveWikiLinkTarget(workspaceFiles, targetName, sourcePath)
    if (resolved?.path !== oldTargetPath) continue

    const leadingWhitespace = rawTarget.match(/^\s*/)?.[0] ?? ''
    const trailingWhitespace = rawTarget.match(/\s*$/)?.[0] ?? ''
    const nextTarget = rewriteTargetSyntax(targetName, newTargetPath, newTargetName)
    const alias = match[2] === undefined ? '' : `|${match[2]}`
    const replacement = `[[${leadingWhitespace}${nextTarget}${trailingWhitespace}${alias}]]`

    rewritten += content.slice(cursor, matchIndex)
    rewritten += replacement
    cursor = matchIndex + match[0].length
    replacements += 1
  }

  if (replacements === 0) return { content, replacements: 0 }

  rewritten += content.slice(cursor)
  return { content: rewritten, replacements }
}
