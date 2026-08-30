'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { FileNode, useEditorStore } from '@/store/editor-store'

const AUTOSAVE_DELAY_MS = 1200
const inFlightSaves = new Map<string, Promise<boolean>>()

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

function hasUnsavedChanges(nodes: FileNode[]): boolean {
  return nodes.some(node => Boolean(node.isModified) || (node.children ? hasUnsavedChanges(node.children) : false))
}

function snapshotData(file: FileNode, content: string): string {
  return file.fileType === 'excalidraw' ? file.excalidrawData || '{}' : content
}

function latestContentFor(file: FileNode): string {
  const state = useEditorStore.getState()
  return state.currentFile?.path === file.path ? state.content : file.content ?? ''
}

async function persistSnapshot(file: FileNode, content: string): Promise<boolean> {
  if (!file.handle || !file.isModified) return true

  const path = file.path
  const data = snapshotData(file, content)
  const existing = inFlightSaves.get(path)

  // FileSystemWritableFileStream writes are serialized per file. If a newer
  // edit arrives while a write is running, wait for it and immediately persist
  // the latest dirty snapshot rather than silently dropping that edit.
  if (existing) {
    const previousSucceeded = await existing
    if (!previousSucceeded) return false

    const latestState = useEditorStore.getState()
    const latestFile = findNodeByPath(latestState.files, path)
    if (latestFile?.handle && latestFile.isModified) {
      return persistSnapshot(latestFile, latestContentFor(latestFile))
    }
    return true
  }

  const save = (async () => {
    try {
      const writable = await file.handle!.createWritable()
      await writable.write(data)
      await writable.close()

      // Do not clear the dirty flag when the user changed the document again
      // while this disk write was in progress.
      const latest = useEditorStore.getState()
      const latestFile = findNodeByPath(latest.files, path)
      if (latestFile && snapshotData(latestFile, latestContentFor(latestFile)) === data) {
        latest.markFileModified(path, false)
      }
      return true
    } catch (error) {
      console.error(`Autosave failed for ${path}:`, error)
      return false
    } finally {
      inFlightSaves.delete(path)
    }
  })()

  inFlightSaves.set(path, save)
  return save
}

export function PersistenceRuntime() {
  const currentFile = useEditorStore(state => state.currentFile)
  const content = useEditorStore(state => state.content)
  const language = useEditorStore(state => state.language)

  // Debounced autosave for the active local file. The delay prevents a disk
  // write for every keystroke while still keeping the local-first workflow safe.
  useEffect(() => {
    if (!currentFile?.handle || !currentFile.isModified) return

    const timer = window.setTimeout(async () => {
      const success = await persistSnapshot(currentFile, content)
      if (!success) {
        toast.error(language === 'zh' ? '自动保存失败，请手动保存。' : 'Autosave failed. Please save manually.')
      }
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [content, currentFile, language])

  // Switching documents used to cancel a pending save. Flush the previous
  // document snapshot only when its old path still exists. Rename/delete
  // operations intentionally replace or remove that path, so writing its stale
  // handle would be both unnecessary and misleading.
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      const previousFile = previousState.currentFile
      if (!previousFile?.handle || !previousFile.isModified) return
      if (previousFile.path === state.currentFile?.path) return
      if (!findNodeByPath(state.files, previousFile.path)) return

      void persistSnapshot(previousFile, previousState.content).then(success => {
        if (!success) {
          toast.error(
            state.language === 'zh'
              ? `“${previousFile.name}”自动保存失败，请返回后手动保存。`
              : `Autosave failed for “${previousFile.name}”. Please save it manually.`
          )
        }
      })
    })

    return unsubscribe
  }, [])

  // Protect the whole workspace, not just the active document. This matters
  // when a previous file is still dirty because saving failed or no disk handle
  // is available.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges(useEditorStore.getState().files)) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      const state = useEditorStore.getState()
      if (state.currentFile?.handle && state.currentFile.isModified) {
        void persistSnapshot(state.currentFile, state.content)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
