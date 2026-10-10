import { sanitize } from './sanitize'
import type { Article, Author } from './model'

export type Settings = {
  paper: string
}

export type BackupImage = {
  id: string
  alt: string
  type: string
  data: string
}

export type Backup = {
  version: 1
  articles: Article[]
  authors: Author[]
  images: BackupImage[]
  settings: Settings
}

export type ImageRecord = {
  id: string
  alt: string
  blob: Blob
}

const PAPER = 'The National Observer'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isArticle(value: unknown): value is Article {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    typeof value.subtitle === 'string' &&
    typeof value.authorId === 'string' &&
    typeof value.date === 'string' &&
    typeof value.bodyHtml === 'string' &&
    (value.thumbnailId === null || typeof value.thumbnailId === 'string') &&
    typeof value.thumbnailAlt === 'string' &&
    typeof value.description === 'string' &&
    typeof value.featured === 'boolean' &&
    typeof value.featuredOrder === 'number' &&
    (value.status === 'draft' || value.status === 'ready' || value.status === 'published') &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    typeof value.updatedAt === 'string'
  )
}

function isAuthor(value: unknown): value is Author {
  if (!isRecord(value)) return false
  const portrait = value.portraitId
  const portraitOk = portrait === undefined || portrait === null || typeof portrait === 'string'
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.bio === 'string' &&
    portraitOk
  )
}

function isBackupImage(value: unknown): value is BackupImage {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.alt === 'string' &&
    typeof value.type === 'string' &&
    typeof value.data === 'string'
  )
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x4000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
}

export function parseBackup(raw: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file is not a paper backup. Choose an export from this app.' }
  }
  if (!isRecord(parsed) || parsed.version !== 1) {
    return { ok: false, error: 'This backup is from a different version of the paper.' }
  }
  if (!Array.isArray(parsed.articles) || !parsed.articles.every(isArticle)) {
    return { ok: false, error: 'This backup is missing its articles.' }
  }
  if (!Array.isArray(parsed.authors) || !parsed.authors.every(isAuthor)) {
    return { ok: false, error: 'This backup is missing its authors.' }
  }
  if (!Array.isArray(parsed.images) || !parsed.images.every(isBackupImage)) {
    return { ok: false, error: 'This backup is missing its images.' }
  }
  try {
    for (const image of parsed.images) base64ToBytes(image.data)
  } catch {
    return { ok: false, error: 'An image in this backup could not be read.' }
  }
  const settings = isRecord(parsed.settings) && typeof parsed.settings.paper === 'string'
    ? { paper: parsed.settings.paper }
    : { paper: PAPER }
  return {
    ok: true,
    backup: {
      version: 1,
      articles: parsed.articles.map((article) => ({ ...article, bodyHtml: sanitize(article.bodyHtml) })),
      authors: parsed.authors.map((author) => ({ ...author, portraitId: author.portraitId ?? null })),
      images: parsed.images,
      settings,
    },
  }
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type })
}

export function imagesFromBackup(images: BackupImage[]): ImageRecord[] {
  return images.map((image) => ({
    id: image.id,
    alt: image.alt,
    blob: bytesToBlob(base64ToBytes(image.data), image.type || 'application/octet-stream'),
  }))
}

export async function buildBackup(input: {
  articles: Article[]
  authors: Author[]
  images: ImageRecord[]
  settings?: Settings
}): Promise<Backup> {
  return {
    version: 1,
    articles: input.articles,
    authors: input.authors,
    images: await Promise.all(
      input.images.map(async (image) => ({
        id: image.id,
        alt: image.alt,
        type: image.blob.type,
        data: await blobToBase64(image.blob),
      })),
    ),
    settings: input.settings ?? { paper: PAPER },
  }
}
