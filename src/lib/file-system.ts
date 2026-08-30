export type FileSystemEntryKind = 'file' | 'folder'

function pathSegments(path: string): string[] {
  return path
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
}

export function isValidEntryName(name: string): boolean {
  const trimmed = name.trim()
  return Boolean(trimmed) && trimmed !== '.' && trimmed !== '..' && !/[\\/]/.test(trimmed)
}

export function parentPathOf(path: string): string {
  const segments = pathSegments(path)
  if (segments.length <= 1) return '/'
  return `/${segments.slice(0, -1).join('/')}`
}

export function basenameOf(path: string): string {
  const segments = pathSegments(path)
  return segments[segments.length - 1] ?? ''
}

export async function getDirectoryHandleAtPath(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle
  for (const segment of pathSegments(path)) {
    current = await current.getDirectoryHandle(segment)
  }
  return current
}

async function entryExists(
  directory: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  for await (const entry of directory.values()) {
    if (entry.name === name) return true
  }
  return false
}

export async function createEntryOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  parentPath: string,
  name: string,
  kind: FileSystemEntryKind,
  initialContent = ''
): Promise<FileSystemFileHandle | null> {
  const parent = await getDirectoryHandleAtPath(rootHandle, parentPath)

  if (await entryExists(parent, name)) {
    throw new Error(`An entry named "${name}" already exists.`)
  }

  if (kind === 'folder') {
    await parent.getDirectoryHandle(name, { create: true })
    return null
  }

  const fileHandle = await parent.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(initialContent)
  await writable.close()
  return fileHandle
}

export async function removeEntryOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
  kind: FileSystemEntryKind
): Promise<void> {
  const parent = await getDirectoryHandleAtPath(rootHandle, parentPathOf(path))
  const name = basenameOf(path)
  await parent.removeEntry(name, { recursive: kind === 'folder' })
}

async function copyFile(
  source: FileSystemFileHandle,
  targetDirectory: FileSystemDirectoryHandle,
  targetName: string
): Promise<FileSystemFileHandle> {
  const sourceFile = await source.getFile()
  const target = await targetDirectory.getFileHandle(targetName, { create: true })
  const writable = await target.createWritable()
  await writable.write(sourceFile)
  await writable.close()
  return target
}

async function copyDirectory(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle
): Promise<void> {
  for await (const entry of source.values()) {
    if (entry.kind === 'directory') {
      const childTarget = await target.getDirectoryHandle(entry.name, { create: true })
      await copyDirectory(entry, childTarget)
    } else {
      await copyFile(entry, target, entry.name)
    }
  }
}

export async function renameEntryOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
  newName: string,
  kind: FileSystemEntryKind
): Promise<FileSystemFileHandle | null> {
  const oldName = basenameOf(path)
  if (oldName === newName) {
    if (kind === 'file') {
      const parent = await getDirectoryHandleAtPath(rootHandle, parentPathOf(path))
      return parent.getFileHandle(oldName)
    }
    return null
  }

  const parent = await getDirectoryHandleAtPath(rootHandle, parentPathOf(path))
  if (await entryExists(parent, newName)) {
    throw new Error(`An entry named "${newName}" already exists.`)
  }

  if (kind === 'file') {
    const source = await parent.getFileHandle(oldName)
    let target: FileSystemFileHandle | null = null
    try {
      target = await copyFile(source, parent, newName)
      await parent.removeEntry(oldName)
      return target
    } catch (error) {
      if (target) {
        await parent.removeEntry(newName).catch(() => undefined)
      }
      throw error
    }
  }

  const source = await parent.getDirectoryHandle(oldName)
  const target = await parent.getDirectoryHandle(newName, { create: true })
  try {
    await copyDirectory(source, target)
    await parent.removeEntry(oldName, { recursive: true })
  } catch (error) {
    await parent.removeEntry(newName, { recursive: true }).catch(() => undefined)
    throw error
  }

  return null
}
