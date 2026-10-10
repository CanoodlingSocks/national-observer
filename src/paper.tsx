import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildBackup, imagesFromBackup, parseBackup, type Backup, type ImageRecord } from './backup'
import { selectPublished, shouldCopyEditionIntoBrowser } from './edition'
import { PaperContext, type PaperChildren, type PaperContextValue, type Urls } from './paper-context'
import {
  QUOTA_MESSAGE,
  deleteArticleRecord,
  deleteAuthorRecord,
  deleteImage,
  getArticles,
  getAuthors,
  getImage,
  getImages,
  getPaperStarted,
  isQuotaError,
  putArticle,
  putArticles,
  putAuthor,
  putImage,
  replacePaper,
  setPaperStarted,
} from './db'
import { imageIdsForArticle, moveFeatured, type Article, type Author } from './model'

async function readEdition(): Promise<Backup | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}edition.json`)
  if (!response.ok) return null
  const parsed = parseBackup(await response.text())
  if (!parsed.ok) return null
  return parsed.backup
}

function usedImageIds(articles: Article[], authors: Author[]) {
  const ids = new Set(articles.flatMap((article) => imageIdsForArticle(article)))
  for (const author of authors) {
    if (author.portraitId) ids.add(author.portraitId)
  }
  return ids
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PaperProvider({ children }: PaperChildren) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [urls, setUrls] = useState<Urls>({})
  const articlesRef = useRef<Article[]>([])
  const authorsRef = useRef<Author[]>([])
  const urlsRef = useRef<Urls>({})
  const pending = useRef(new Set<string>())

  useEffect(() => {
    articlesRef.current = articles
  }, [articles])

  const forgetUrls = useCallback((ids: string[]) => {
    const next = { ...urlsRef.current }
    for (const id of ids) {
      const value = next[id]
      if (typeof value === 'string') URL.revokeObjectURL(value)
      delete next[id]
    }
    urlsRef.current = next
    setUrls(next)
  }, [])

  const clearUrls = useCallback(() => {
    for (const value of Object.values(urlsRef.current)) {
      if (typeof value === 'string') URL.revokeObjectURL(value)
    }
    urlsRef.current = {}
    setUrls({})
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [storedArticles, storedAuthors, started] = await Promise.all([
        getArticles(),
        getAuthors(),
        getPaperStarted(),
      ])
      if (cancelled) return
      let nextArticles = storedArticles
      let nextAuthors = storedAuthors
      if (shouldCopyEditionIntoBrowser({
        articleCount: storedArticles.length,
        authorCount: storedAuthors.length,
        started,
      })) {
        const edition = await readEdition()
        if (cancelled) return
        if (edition) {
          await replacePaper({
            articles: edition.articles,
            authors: edition.authors,
            images: imagesFromBackup(edition.images),
            settings: edition.settings,
          })
          await setPaperStarted()
          nextArticles = edition.articles
          nextAuthors = edition.authors
        }
      } else if (!started) {
        await setPaperStarted()
      }
      if (cancelled) return
      articlesRef.current = nextArticles
      authorsRef.current = nextAuthors
      setArticles(nextArticles)
      setAuthors(nextAuthors)
      setReady(true)
    }
    load().catch(() => {
      if (!cancelled) setLoadError('This browser blocked local storage. The paper cannot be saved here.')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => clearUrls(), [clearUrls])

  const retainImages = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => urlsRef.current[id] === undefined && !pending.current.has(id))
    if (!missing.length) return
    for (const id of missing) pending.current.add(id)
    try {
      const found = await Promise.all(missing.map(async (id) => [id, await getImage(id)] as const))
      const next = { ...urlsRef.current }
      for (const [id, image] of found) {
        next[id] = image ? URL.createObjectURL(image.blob) : false
      }
      urlsRef.current = next
      setUrls(next)
    } finally {
      for (const id of missing) pending.current.delete(id)
    }
  }, [])

  const saveArticle = useCallback(async (article: Article) => {
    const previous = articlesRef.current.find((item) => item.id === article.id)
    try {
      await putArticle(article)
    } catch (error) {
      if (isQuotaError(error)) throw new Error(QUOTA_MESSAGE)
      throw error
    }
    const next = previous
      ? articlesRef.current.map((item) => (item.id === article.id ? article : item))
      : [...articlesRef.current, article]
    articlesRef.current = next
    setArticles(next)
    const previousIds = previous ? imageIdsForArticle(previous) : []
    const kept = new Set(imageIdsForArticle(article))
    const stillUsed = usedImageIds(next, authorsRef.current)
    for (const id of previousIds) {
      if (!kept.has(id) && !stillUsed.has(id)) {
        await deleteImage(id)
        forgetUrls([id])
      }
    }
  }, [forgetUrls])

  const removeArticle = useCallback(async (id: string) => {
    const current = articlesRef.current.find((item) => item.id === id)
    await deleteArticleRecord(id)
    const next = articlesRef.current.filter((item) => item.id !== id)
    articlesRef.current = next
    setArticles(next)
    if (!current) return
    const stillUsed = usedImageIds(next, authorsRef.current)
    for (const imageId of imageIdsForArticle(current)) {
      if (!stillUsed.has(imageId)) {
        await deleteImage(imageId)
        forgetUrls([imageId])
      }
    }
  }, [forgetUrls])

  const saveAuthor = useCallback(async (author: Author) => {
    const previous = authorsRef.current.find((item) => item.id === author.id)
    await putAuthor(author)
    const next = previous
      ? authorsRef.current.map((item) => (item.id === author.id ? author : item))
      : [...authorsRef.current, author]
    authorsRef.current = next
    setAuthors(next)
    const oldPortrait = previous?.portraitId
    if (oldPortrait && oldPortrait !== author.portraitId && !usedImageIds(articlesRef.current, next).has(oldPortrait)) {
      await deleteImage(oldPortrait)
      forgetUrls([oldPortrait])
    }
  }, [forgetUrls])

  const removeAuthor = useCallback(async (id: string) => {
    const linked = articlesRef.current.some((article) => article.authorId === id)
    if (linked) throw new Error('This author is still linked to a piece.')
    const current = authorsRef.current.find((author) => author.id === id)
    await deleteAuthorRecord(id)
    const next = authorsRef.current.filter((author) => author.id !== id)
    authorsRef.current = next
    setAuthors(next)
    const portraitId = current?.portraitId
    if (portraitId && !usedImageIds(articlesRef.current, next).has(portraitId)) {
      await deleteImage(portraitId)
      forgetUrls([portraitId])
    }
  }, [forgetUrls])

  const saveImage = useCallback(async (image: ImageRecord) => {
    try {
      await putImage(image)
    } catch (error) {
      if (isQuotaError(error)) throw new Error(QUOTA_MESSAGE)
      throw error
    }
    const next = { ...urlsRef.current }
    const previous = next[image.id]
    if (typeof previous === 'string') URL.revokeObjectURL(previous)
    next[image.id] = URL.createObjectURL(image.blob)
    urlsRef.current = next
    setUrls(next)
  }, [])

  const reorderFeatured = useCallback(async (id: string, direction: -1 | 1) => {
    const next = moveFeatured(articlesRef.current, id, direction)
    if (next === articlesRef.current) return
    const previous = articlesRef.current
    articlesRef.current = next
    setArticles(next)
    try {
      await putArticles(next.filter((article) => article.featured))
    } catch (error) {
      articlesRef.current = previous
      setArticles(previous)
      if (isQuotaError(error)) throw new Error(QUOTA_MESSAGE)
      throw error
    }
  }, [])

  const exportPaper = useCallback(async () => {
    const [storedArticles, storedAuthors, storedImages] = await Promise.all([getArticles(), getAuthors(), getImages()])
    const backup = await buildBackup({ articles: storedArticles, authors: storedAuthors, images: storedImages })
    downloadJson('national-observer-backup.json', backup)
  }, [])

  const exportEdition = useCallback(async () => {
    const [storedArticles, storedAuthors, storedImages] = await Promise.all([getArticles(), getAuthors(), getImages()])
    const published = selectPublished({ articles: storedArticles, authors: storedAuthors, images: storedImages })
    const edition = await buildBackup(published)
    downloadJson('edition.json', edition)
  }, [])

  const importPaper = useCallback(async (backup: Backup) => {
    await replacePaper({
      articles: backup.articles,
      authors: backup.authors,
      images: imagesFromBackup(backup.images),
      settings: backup.settings,
    })
    await setPaperStarted()
    clearUrls()
    articlesRef.current = backup.articles
    authorsRef.current = backup.authors
    setArticles(backup.articles)
    setAuthors(backup.authors)
  }, [clearUrls])

  const value = useMemo<PaperContextValue>(
    () => ({
      ready,
      loadError,
      articles,
      authors,
      urls,
      retainImages,
      saveArticle,
      removeArticle,
      saveAuthor,
      removeAuthor,
      saveImage,
      reorderFeatured,
      exportPaper,
      exportEdition,
      importPaper,
    }),
    [
      ready,
      loadError,
      articles,
      authors,
      urls,
      retainImages,
      saveArticle,
      removeArticle,
      saveAuthor,
      removeAuthor,
      saveImage,
      reorderFeatured,
      exportPaper,
      exportEdition,
      importPaper,
    ],
  )

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>
}

export { usePaper } from './paper-context'
