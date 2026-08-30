import { detectFileType, FileNode } from '@/store/editor-store'

const DEFAULT_IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.next'])

export async function scanWorkspaceDirectory(
  root: FileSystemDirectoryHandle,
  options: { ignoredDirectories?: Set<string> } = {}
): Promise<FileNode[]> {
  const ignoredDirectories = options.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES

  const scan = async (handle: FileSystemDirectoryHandle, path = ''): Promise<FileNode[]> => {
    const entries: FileSystemHandle[] = []
    for await (const entry of handle.values()) entries.push(entry)

    const nodes = await Promise.all(entries.map(async (entry): Promise<FileNode | null> => {
      const entryPath = path ? `${path}/${entry.name}` : entry.name

      if (entry.kind === 'directory') {
        if (ignoredDirectories.has(entry.name)) return null
        const children = await scan(entry, entryPath)
        return {
          id: entryPath,
          name: entry.name,
          type: 'folder',
          path: `/${entryPath}`,
          children,
        }
      }

      const file = await entry.getFile()
      const fileType = detectFileType(entry.name)
      const readableText = fileType === 'markdown' || fileType === 'text' || fileType === 'excalidraw'
      const fileContent = readableText ? await file.text() : undefined
      const blobUrl = fileType === 'image' || fileType === 'pdf'
        ? URL.createObjectURL(file)
        : undefined

      return {
        id: entryPath,
        name: entry.name,
        type: 'file',
        fileType,
        path: `/${entryPath}`,
        content: fileType === 'markdown' || fileType === 'text' ? fileContent : undefined,
        excalidrawData: fileType === 'excalidraw' ? fileContent : undefined,
        blobUrl,
        mimeType: file.type,
        handle: entry,
        isModified: false,
      }
    }))

    return nodes
      .filter((node): node is FileNode => Boolean(node))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  return scan(root)
}

export function findFirstWorkspaceFile(nodes: FileNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.type === 'file') return node
    if (node.children) {
      const found = findFirstWorkspaceFile(node.children)
      if (found) return found
    }
  }
  return null
}

export function findWorkspaceFileByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === path) return node
    if (node.children) {
      const found = findWorkspaceFileByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}
