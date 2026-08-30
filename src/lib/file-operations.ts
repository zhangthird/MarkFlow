import { isValidEntryName, parentPathOf } from '@/lib/file-system'
import { FileNode, useEditorStore } from '@/store/editor-store'

export type FileOperationCode =
  | 'success'
  | 'invalid_name'
  | 'already_exists'
  | 'parent_not_found'
  | 'not_found'
  | 'unchanged'
  | 'io_error'

export interface FileOperationResult {
  ok: boolean
  code: FileOperationCode
  path?: string
  previousPath?: string
}

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const match = findNodeByPath(node.children, path)
      if (match) return match
    }
  }
  return null
}

function entryPath(parentPath: string, name: string): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`
}

function waitForWorkspaceState(
  predicate: (files: FileNode[]) => boolean,
  startOperation: () => void,
  timeoutMs = 30_000
): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false

    const finish = (success: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      unsubscribe()
      resolve(success)
    }

    const unsubscribe = useEditorStore.subscribe(state => {
      if (predicate(state.files)) finish(true)
    })

    const timeout = window.setTimeout(() => finish(false), timeoutMs)

    try {
      startOperation()
      if (predicate(useEditorStore.getState().files)) finish(true)
    } catch {
      finish(false)
    }
  })
}

export async function createWorkspaceEntry(
  parentPath: string,
  rawName: string,
  type: 'file' | 'folder'
): Promise<FileOperationResult> {
  const name = rawName.trim()
  if (!isValidEntryName(name)) return { ok: false, code: 'invalid_name' }

  const state = useEditorStore.getState()
  if (parentPath !== '/') {
    const parent = findNodeByPath(state.files, parentPath)
    if (!parent || parent.type !== 'folder') {
      return { ok: false, code: 'parent_not_found', path: parentPath }
    }
  }

  const path = entryPath(parentPath, name)
  if (findNodeByPath(state.files, path)) {
    return { ok: false, code: 'already_exists', path }
  }

  const completed = await waitForWorkspaceState(
    files => Boolean(findNodeByPath(files, path)),
    () => useEditorStore.getState().addFile(parentPath, name, type)
  )

  return completed
    ? { ok: true, code: 'success', path }
    : { ok: false, code: 'io_error', path }
}

export async function deleteWorkspaceEntry(path: string): Promise<FileOperationResult> {
  const state = useEditorStore.getState()
  if (!findNodeByPath(state.files, path)) {
    return { ok: false, code: 'not_found', path }
  }

  const completed = await waitForWorkspaceState(
    files => !findNodeByPath(files, path),
    () => useEditorStore.getState().deleteFile(path)
  )

  return completed
    ? { ok: true, code: 'success', previousPath: path }
    : { ok: false, code: 'io_error', path }
}

export async function renameWorkspaceEntry(
  path: string,
  rawNewName: string
): Promise<FileOperationResult> {
  const newName = rawNewName.trim()
  if (!isValidEntryName(newName)) return { ok: false, code: 'invalid_name', previousPath: path }

  const state = useEditorStore.getState()
  const target = findNodeByPath(state.files, path)
  if (!target) return { ok: false, code: 'not_found', previousPath: path }
  if (target.name === newName) return { ok: true, code: 'unchanged', path, previousPath: path }

  const parentPath = parentPathOf(path)
  const newPath = entryPath(parentPath, newName)
  if (findNodeByPath(state.files, newPath)) {
    return { ok: false, code: 'already_exists', path: newPath, previousPath: path }
  }

  const completed = await waitForWorkspaceState(
    files => !findNodeByPath(files, path) && Boolean(findNodeByPath(files, newPath)),
    () => useEditorStore.getState().renameFile(path, newName)
  )

  return completed
    ? { ok: true, code: 'success', path: newPath, previousPath: path }
    : { ok: false, code: 'io_error', path: newPath, previousPath: path }
}
