'use client'

import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editor-store'
import {
  findFirstWorkspaceFile,
  findWorkspaceFileByPath,
  scanWorkspaceDirectory,
} from '@/lib/workspace-loader'
import {
  getLastWorkspaceFilePath,
  getWorkspaceDirectoryHandle,
  saveLastWorkspaceFilePath,
  saveWorkspaceDirectoryHandle,
} from '@/lib/workspace-persistence'

export function useWorkspaceDirectory() {
  const currentFile = useEditorStore(state => state.currentFile)
  const language = useEditorStore(state => state.language)
  const t = useEditorStore(state => state.t)
  const setFiles = useEditorStore(state => state.setFiles)
  const setRootFolderName = useEditorStore(state => state.setRootFolderName)
  const setCurrentFile = useEditorStore(state => state.setCurrentFile)
  const setRootHandle = useEditorStore(state => state.setRootHandle)

  const loadDirectory = useCallback(async (directory: FileSystemDirectoryHandle) => {
    const files = await scanWorkspaceDirectory(directory)
    setRootHandle(directory)
    setFiles(files)
    setRootFolderName(directory.name)

    const lastPath = getLastWorkspaceFilePath()
    const restoredFile = lastPath ? findWorkspaceFileByPath(files, lastPath) : null
    const initialFile = restoredFile ?? findFirstWorkspaceFile(files)
    setCurrentFile(initialFile)
  }, [setCurrentFile, setFiles, setRootFolderName, setRootHandle])

  const openFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      toast.error(t('browserNotSupported'))
      return
    }

    try {
      const directory = await (
        window as Window & {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>
        }
      ).showDirectoryPicker()

      await loadDirectory(directory)
      await saveWorkspaceDirectoryHandle(directory)
      toast.success(`${t('folderOpened')}: ${directory.name}`)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      console.error('Failed to open workspace:', error)
      toast.error(t('openFolderFailed'))
    }
  }, [loadDirectory, t])

  useEffect(() => {
    if (currentFile?.path) saveLastWorkspaceFilePath(currentFile.path)
  }, [currentFile?.path])

  useEffect(() => {
    const restore = async () => {
      if (!('showDirectoryPicker' in window)) return

      try {
        const savedHandle = await getWorkspaceDirectoryHandle()
        if (!savedHandle) return

        // Permission prompts require a user gesture in Chromium. Querying here
        // is safe; if permission was not retained, keep the saved handle and ask
        // the user to use Open instead of triggering a doomed requestPermission
        // call during page startup.
        const permission = await savedHandle.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted') {
          toast.info(
            language === 'zh'
              ? '已检测到上次目录，请点击“打开”重新授权。'
              : 'Previous folder detected. Click “Open” to re-authorize access.'
          )
          return
        }

        await loadDirectory(savedHandle)
      } catch (error) {
        console.error('Failed to restore previous workspace:', error)
      }
    }

    void restore()
  }, [language, loadDirectory])

  return { openFolder, loadDirectory }
}
