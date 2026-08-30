const PERSIST_DB_NAME = 'markflow-persistence'
const PERSIST_STORE = 'kv'
const ROOT_HANDLE_KEY = 'root-directory-handle'
const LAST_FILE_PATH_KEY = 'last-open-file-path'

async function getPersistDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PERSIST_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PERSIST_STORE)) db.createObjectStore(PERSIST_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getPersistDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PERSIST_STORE, 'readwrite')
    transaction.objectStore(PERSIST_STORE).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await getPersistDb()
  const value = await new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(PERSIST_STORE, 'readonly')
    const request = transaction.objectStore(PERSIST_STORE).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

export function saveLastWorkspaceFilePath(path: string): void {
  localStorage.setItem(LAST_FILE_PATH_KEY, path)
}

export function getLastWorkspaceFilePath(): string | null {
  return localStorage.getItem(LAST_FILE_PATH_KEY)
}

export async function saveWorkspaceDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(ROOT_HANDLE_KEY, handle)
}

export async function getWorkspaceDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return idbGet<FileSystemDirectoryHandle>(ROOT_HANDLE_KEY)
}
