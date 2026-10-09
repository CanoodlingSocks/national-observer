import { createContext, useContext, type ReactNode } from 'react'
import type { Backup, ImageRecord } from './backup'
import type { Article, Author } from './model'

export type Urls = Record<string, string | false>

export type PaperContextValue = {
  ready: boolean
  loadError: string | null
  articles: Article[]
  authors: Author[]
  urls: Urls
  retainImages: (ids: string[]) => Promise<void>
  saveArticle: (article: Article) => Promise<void>
  removeArticle: (id: string) => Promise<void>
  saveAuthor: (author: Author) => Promise<void>
  removeAuthor: (id: string) => Promise<void>
  saveImage: (image: ImageRecord) => Promise<void>
  reorderFeatured: (id: string, direction: -1 | 1) => Promise<void>
  exportPaper: () => Promise<void>
  exportEdition: () => Promise<void>
  importPaper: (backup: Backup) => Promise<void>
}

export const PaperContext = createContext<PaperContextValue | null>(null)

export function usePaper(): PaperContextValue {
  const value = useContext(PaperContext)
  if (!value) throw new Error('usePaper must be used inside PaperProvider')
  return value
}

export function readOnly(): Promise<void> {
  return Promise.reject(new Error('The public paper is read-only.'))
}

export type PaperChildren = { children: ReactNode }
