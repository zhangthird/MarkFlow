import { FileNode, useEditorStore } from '@/store/editor-store'
import {
  findFirstWorkspaceFile,
  findWorkspaceFileByPath,
  scanWorkspaceDirectory,
} from '@/lib/workspace-loader'

export type WorkspaceRefreshCode =
  | 'success'
  | 'no_workspace'
  | 'dirty_files'
  | 'scan_failed'

export interface WorkspaceRefreshResult {
  ok: boolean
  code: WorkspaceRefreshCode
  dirtyPaths?: string[]
  currentPath?: string
}

export function collectDirtyWorkspacePaths(nodes: FileNode[]): string[] {
  const dirtyPaths: string[] = []

  const visit = (items: FileNode[]) => {
    for (const node of items) {
      if (node.type === 'file' && node.isModified) dirtyPaths.push(node.path)
      if (node.children) visit(node.children)
    }
  }

  visit(nodes)
  return dirtyPaths
}

/**
 * Re-read the current local workspace from disk without risking unsaved edits.
 *
 * MarkFlow currently does not maintain a three-way merge/conflict model. Until
 * it does, the only safe automatic policy is to refuse a disk refresh whenever
 * any in-memory file is dirty. Once the tree is clean, disk is the source of
 * truth and can replace the in-memory snapshot atomically.
 */
export async function refreshWorkspaceFromDisk(): Promise<WorkspaceRefreshResult> {
  const state = useEditorStore.getState()
  const rootHandle = state.rootHandle

  if (!rootHandle) return { ok: false, code: 'no_workspace' }

  const dirtyPaths = collectDirtyWorkspacePaths(state.files)
  if (dirtyPaths.length > 0) {
    return { ok: false, code: 'dirty_files', dirtyPaths }
  }

  try {
    const previousPath = state.currentFile?.path
    const files = await scanWorkspaceDirectory(rootHandle)
    const nextCurrentFile = previousPath
      ? findWorkspaceFileByPath(files, previousPath) ?? findFirstWorkspaceFile(files)
      : findFirstWorkspaceFile(files)

    // setFiles owns blob-URL cleanup for the previous tree. The newly scanned
    // nodes already contain fresh handles/blob URLs from the current disk state.
    state.setFiles(files)
    state.setRootFolderName(rootHandle.name)
    state.setCurrentFile(nextCurrentFile)

    // A disk refresh establishes a new clean baseline. History/search entries
    // created from the previous snapshot must not survive into this baseline.
    state.clearHistory()
    state.setSearchQuery('')
    state.searchInFiles()

    return {
      ok: true,
      code: 'success',
      currentPath: nextCurrentFile?.path,
    }
  } catch (error) {
    console.error('Failed to refresh workspace:', error)
    return { ok: false, code: 'scan_failed' }
  }
}
