import type { ImageRecord, Settings } from './backup'
import type { Article, Author } from './model'

const DB_NAME = 'national-observer'
const DB_VERSION = 1

type StoreName = 'articles' | 'authors' | 'images' | 'meta'
type MetaRecord = { key: 'settings'; value: Settings } | { key: 'paperStarted'; value: true }

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION)
      open.onupgradeneeded = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('articles')) db.createObjectStore('articles', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('authors')) db.createObjectStore('authors', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => {
        dbPromise = null
        reject(open.error)
      }
    })
  }
  return dbPromise
}

function run<T>(name: StoreName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(name, mode)
        const req = fn(tx.objectStore(name))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export function getPaperStarted(): Promise<boolean> {
  return run<MetaRecord | undefined>('meta', 'readonly', (store) => store.get('paperStarted')).then(
    (record) => record?.key === 'paperStarted' && record.value === true,
  )
}

export function setPaperStarted(): Promise<void> {
  const record: MetaRecord = { key: 'paperStarted', value: true }
  return run('meta', 'readwrite', (store) => store.put(record)).then(() => undefined)
}

export function getArticles(): Promise<Article[]> {
  return run('articles', 'readonly', (store) => store.getAll())
}

export function getAuthors(): Promise<Author[]> {
  return run('authors', 'readonly', (store) => store.getAll())
}

export function getImages(): Promise<ImageRecord[]> {
  return run('images', 'readonly', (store) => store.getAll())
}

export function getImage(id: string): Promise<ImageRecord | undefined> {
  return run('images', 'readonly', (store) => store.get(id))
}

export function putArticle(article: Article): Promise<void> {
  return run('articles', 'readwrite', (store) => store.put(article)).then(() => undefined)
}

export function putAuthor(author: Author): Promise<void> {
  return run('authors', 'readwrite', (store) => store.put(author)).then(() => undefined)
}

export function putImage(image: ImageRecord): Promise<void> {
  return run('images', 'readwrite', (store) => store.put(image)).then(() => undefined)
}

export function deleteArticleRecord(id: string): Promise<void> {
  return run('articles', 'readwrite', (store) => store.delete(id)).then(() => undefined)
}

export function deleteAuthorRecord(id: string): Promise<void> {
  return run('authors', 'readwrite', (store) => store.delete(id)).then(() => undefined)
}

export function deleteImage(id: string): Promise<void> {
  return run('images', 'readwrite', (store) => store.delete(id)).then(() => undefined)
}

export async function putArticles(articles: Article[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('articles', 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    for (const article of articles) tx.objectStore('articles').put(article)
  })
}

export async function replacePaper(input: {
  articles: Article[]
  authors: Author[]
  images: ImageRecord[]
  settings: Settings
}): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['articles', 'authors', 'images', 'meta'], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    tx.objectStore('articles').clear()
    tx.objectStore('authors').clear()
    tx.objectStore('images').clear()
    for (const article of input.articles) tx.objectStore('articles').put(article)
    for (const author of input.authors) tx.objectStore('authors').put(author)
    for (const image of input.images) tx.objectStore('images').put(image)
    const meta: MetaRecord = { key: 'settings', value: input.settings }
    tx.objectStore('meta').put(meta)
  })
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
}

export const QUOTA_MESSAGE = 'This browser ran out of space for the paper. Export a backup, then remove an image.'
