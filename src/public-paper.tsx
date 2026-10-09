import { useCallback, useEffect, useMemo, useState } from 'react'
import { imagesFromBackup, parseBackup } from './backup'
import { selectPublished } from './edition'
import { PaperContext, readOnly, type PaperChildren, type PaperContextValue, type Urls } from './paper-context'

export function PublicPaperProvider({ children }: PaperChildren) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articles, setArticles] = useState<PaperContextValue['articles']>([])
  const [authors, setAuthors] = useState<PaperContextValue['authors']>([])
  const [urls, setUrls] = useState<Urls>({})

  useEffect(() => {
    let cancelled = false
    const created: string[] = []

    async function load() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}edition.json`)
        if (cancelled) return
        if (!response.ok) {
          setReady(true)
          return
        }
        const parsed = parseBackup(await response.text())
        if (cancelled) return
        if (!parsed.ok) {
          setLoadError('The published edition could not be read.')
          return
        }
        const published = selectPublished({
          articles: parsed.backup.articles,
          authors: parsed.backup.authors,
          images: parsed.backup.images,
        })
        const next: Urls = {}
        for (const image of imagesFromBackup(published.images)) {
          const url = URL.createObjectURL(image.blob)
          created.push(url)
          next[image.id] = url
        }
        if (cancelled) {
          for (const url of created) URL.revokeObjectURL(url)
          return
        }
        setArticles(published.articles)
        setAuthors(published.authors)
        setUrls(next)
        setReady(true)
      } catch {
        if (!cancelled) setLoadError('The published edition could not be opened.')
      }
    }

    void load()
    return () => {
      cancelled = true
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [])

  const retainImages = useCallback(async (ids: string[]) => {
    setUrls((current) => {
      let changed = false
      const next = { ...current }
      for (const id of ids) {
        if (next[id] === undefined) {
          next[id] = false
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [])

  const value = useMemo<PaperContextValue>(
    () => ({
      ready,
      loadError,
      articles,
      authors,
      urls,
      retainImages,
      saveArticle: readOnly,
      removeArticle: readOnly,
      saveAuthor: readOnly,
      removeAuthor: readOnly,
      saveImage: readOnly,
      reorderFeatured: readOnly,
      exportPaper: readOnly,
      exportEdition: readOnly,
      importPaper: readOnly,
    }),
    [ready, loadError, articles, authors, urls, retainImages],
  )

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>
}
