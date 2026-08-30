'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { FileNode, useEditorStore } from '@/store/editor-store'
import {
  collectWorkspaceFiles,
  rewriteWikiLinksForFileRename,
} from '@/lib/wiki-links'

interface ContentRewrite {
  path: string
  content: string
  replacements: number
  wasModified: boolean
}

function parentPath(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

function applyRewrites(nodes: FileNode[], rewrites: Map<string, ContentRewrite>): FileNode[] {
  return nodes.map(node => {
    const rewrite = rewrites.get(node.path)
    if (rewrite) {
      return { ...node, content: rewrite.content, isModified: true }
    }
    if (node.children) {
      return { ...node, children: applyRewrites(node.children, rewrites) }
    }
    return node
  })
}

function detectSingleMarkdownRename(
  previousFiles: FileNode[],
  nextFiles: FileNode[]
): { oldFile: FileNode; newFile: FileNode } | null {
  const previousFlat = collectWorkspaceFiles(previousFiles)
  const nextFlat = collectWorkspaceFiles(nextFiles)
  const previousPaths = new Set(previousFlat.map(file => file.path))
  const nextPaths = new Set(nextFlat.map(file => file.path))

  const removed = previousFlat.filter(file => !nextPaths.has(file.path))
  const added = nextFlat.filter(file => !previousPaths.has(file.path))

  if (removed.length !== 1 || added.length !== 1) return null

  const oldFile = removed[0]
  const newFile = added[0]

  // A folder rename can also make descendant file paths disappear/reappear.
  // Requiring the same parent and a changed basename restricts this runtime to
  // a direct file rename, which is the operation whose Wiki references we can
  // refactor without guessing.
  if (parentPath(oldFile.path) !== parentPath(newFile.path)) return null
  if (oldFile.name === newFile.name) return null
  if (oldFile.fileType !== 'markdown' || newFile.fileType !== 'markdown') return null

  return { oldFile, newFile }
}

async function persistRewrite(rewrite: ContentRewrite): Promise<boolean> {
  const state = useEditorStore.getState()
  const file = findNodeByPath(state.files, rewrite.path)
  if (!file?.handle) return false

  try {
    const writable = await file.handle.createWritable()
    await writable.write(rewrite.content)
    await writable.close()

    const latest = useEditorStore.getState()
    const latestFile = findNodeByPath(latest.files, rewrite.path)
    if (latestFile?.content === rewrite.content) {
      latest.markFileModified(rewrite.path, false)
    }
    return true
  } catch (error) {
    console.error(`Failed to persist Wiki-link refactor for ${rewrite.path}:`, error)
    return false
  }
}

export function WikiLinkRenameRuntime() {
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      // The file tree also changes for ordinary edits because the active node is
      // replaced with an updated immutable copy. Bail out before any workspace
      // traversal for the editor hot path; rename detection should only pay its
      // O(workspace) cost for structural/metadata mutations such as CRUD.
      if (state.files === previousState.files) return

      const sameActivePath = state.currentFile?.path === previousState.currentFile?.path
      if (sameActivePath && state.content !== previousState.content) return
      if (
        sameActivePath &&
        state.currentFile?.excalidrawData !== previousState.currentFile?.excalidrawData
      ) return

      const rename = detectSingleMarkdownRename(previousState.files, state.files)
      if (!rename) return

      const previousFlat = collectWorkspaceFiles(previousState.files)
      const nextFlat = collectWorkspaceFiles(state.files)
      const rewrites = new Map<string, ContentRewrite>()
      let replacementCount = 0

      for (const nextFile of nextFlat) {
        if (nextFile.fileType !== 'markdown' || nextFile.content === undefined) continue

        const sourcePathBeforeRename = nextFile.path === rename.newFile.path
          ? rename.oldFile.path
          : nextFile.path
        const previousSource = previousFlat.find(file => file.path === sourcePathBeforeRename)
        const sourceContent = nextFile.content

        const result = rewriteWikiLinksForFileRename(
          sourceContent,
          sourcePathBeforeRename,
          previousFlat,
          rename.oldFile.path,
          rename.newFile.path,
          rename.newFile.name
        )

        if (result.replacements === 0 || result.content === sourceContent) continue

        rewrites.set(nextFile.path, {
          path: nextFile.path,
          content: result.content,
          replacements: result.replacements,
          wasModified: Boolean(previousSource?.isModified),
        })
        replacementCount += result.replacements
      }

      if (rewrites.size === 0) return

      // Apply all source-level edits as one store transition. If the currently
      // open note is among them, also update the active editor content. These
      // changes intentionally remain dirty until their exact snapshot reaches
      // disk.
      useEditorStore.setState(current => {
        const files = applyRewrites(current.files, rewrites)
        const currentRewrite = current.currentFile ? rewrites.get(current.currentFile.path) : undefined
        const currentFile = current.currentFile?.path
          ? findNodeByPath(files, current.currentFile.path)
          : current.currentFile

        return {
          files,
          currentFile,
          content: currentRewrite?.content ?? current.content,
        }
      })

      // Clean source notes can be persisted as part of the refactor. Notes that
      // were already dirty before the rename stay dirty so the refactor never
      // silently commits unrelated unsaved edits from another document.
      const safeToPersist = [...rewrites.values()].filter(rewrite => !rewrite.wasModified)

      void Promise.all(safeToPersist.map(persistRewrite)).then(results => {
        const failedWrites = results.filter(success => !success).length
        const language = useEditorStore.getState().language

        if (failedWrites > 0) {
          toast.warning(
            language === 'zh'
              ? `已更新 ${replacementCount} 个 Wiki Link；${failedWrites} 个文件仍需手动保存。`
              : `Updated ${replacementCount} Wiki links; ${failedWrites} files still need to be saved manually.`
          )
          return
        }

        toast.success(
          language === 'zh'
            ? `已同步更新 ${replacementCount} 个 Wiki Link。`
            : `Updated ${replacementCount} Wiki links after the rename.`
        )
      })
    })

    return unsubscribe
  }, [])

  return null
}
