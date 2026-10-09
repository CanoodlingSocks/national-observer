import { useEffect, useMemo } from 'react'
import { imageIdsFromHtml } from '../model'
import { usePaper } from '../paper-context'
import { hydrateImages } from '../sanitize'

export function Prose({ html }: { html: string }) {
  const { urls, retainImages } = usePaper()
  const ids = useMemo(() => imageIdsFromHtml(html), [html])

  useEffect(() => {
    void retainImages(ids)
  }, [ids, retainImages])

  const rendered = useMemo(() => hydrateImages(html, urls), [html, urls])
  return <div className="prose" dangerouslySetInnerHTML={{ __html: rendered }} />
}

export function StoredImage({
  id,
  alt,
  className,
  loading,
}: {
  id: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}) {
  const { urls, retainImages } = usePaper()

  useEffect(() => {
    void retainImages([id])
  }, [id, retainImages])

  const url = urls[id]
  if (url === false) return <p className="image-missing">Image missing from this browser.</p>
  if (typeof url !== 'string') return <div className={`image-pending ${className ?? ''}`} role="status" aria-label="Loading image" />
  return <img className={className} src={url} alt={alt} loading={loading} />
}
