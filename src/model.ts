export type ArticleStatus = 'draft' | 'published'

export type Article = {
  id: string
  title: string
  subtitle: string
  authorId: string
  date: string
  bodyHtml: string
  thumbnailId: string | null
  thumbnailAlt: string
  description: string
  featured: boolean
  featuredOrder: number
  status: ArticleStatus
  tags: string[]
  updatedAt: string
}

export type Author = {
  id: string
  name: string
  bio: string
  portraitId: string | null
}

export type FieldErrors = Record<string, string>

export function todayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function blankArticle(id: string, now = new Date()): Article {
  return {
    id,
    title: '',
    subtitle: '',
    authorId: '',
    date: todayISO(now),
    bodyHtml: '',
    thumbnailId: null,
    thumbnailAlt: '',
    description: '',
    featured: false,
    featuredOrder: 0,
    status: 'draft',
    tags: [],
    updatedAt: now.toISOString(),
  }
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of input.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ')
    if (!tag) continue
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export function draftErrors(article: Pick<Article, 'title'>): FieldErrors {
  const errors: FieldErrors = {}
  if (!article.title.trim()) {
    errors.title = 'Give the piece a headline before saving.'
  }
  return errors
}

export function publishErrors(article: Pick<Article, 'title' | 'authorId' | 'date' | 'featured' | 'description'>): FieldErrors {
  const errors = draftErrors(article)
  if (!article.authorId) {
    errors.authorId = 'Choose an author before publishing.'
  }
  if (!article.date) {
    errors.date = 'Choose the date this piece was written.'
  }
  if (article.featured && !article.description.trim()) {
    errors.description = 'A featured piece needs a description before it can be published.'
  }
  return errors
}

export function excerpt(html: string, limit = 180): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const plain = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (plain.length <= limit) return plain
  const cut = plain.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const base = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()
  return `${base}…`
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function imageIdsFromHtml(html: string): string[] {
  return [...html.matchAll(/data-image-id="([^"]+)"/g)].map((match) => match[1])
}

export function imageIdsForArticle(article: Pick<Article, 'bodyHtml' | 'thumbnailId'>): string[] {
  const ids = new Set(imageIdsFromHtml(article.bodyHtml))
  if (article.thumbnailId) ids.add(article.thumbnailId)
  return [...ids]
}

export function nextFeaturedOrder(articles: Article[]): number {
  const orders = articles.filter((article) => article.featured).map((article) => article.featuredOrder)
  if (!orders.length) return 0
  return Math.max(...orders) + 1
}

export function byFeaturedOrder(a: Article, b: Article): number {
  return a.featuredOrder - b.featuredOrder || a.title.localeCompare(b.title) || b.date.localeCompare(a.date)
}

export function tagList(articles: Article[]): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const article of articles) {
    for (const tag of article.tags) {
      const key = tag.toLocaleLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags.sort((a, b) => a.localeCompare(b))
}

function hasTag(article: Article, tag: string): boolean {
  const key = tag.toLocaleLowerCase()
  return article.tags.some((item) => item.toLocaleLowerCase() === key)
}

export function paperSelection(articles: Article[], tag: string | null) {
  const published = articles.filter((article) => article.status === 'published')
  const matches = (article: Article) => !tag || hasTag(article, tag)
  return {
    featured: published.filter((article) => article.featured && matches(article)).sort(byFeaturedOrder),
    rows: published
      .filter((article) => !article.featured && matches(article))
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)),
    tags: tagList(published),
  }
}

export function moveFeatured(articles: Article[], id: string, direction: -1 | 1): Article[] {
  const featured = articles.filter((article) => article.featured).slice().sort(byFeaturedOrder)
  const index = featured.findIndex((article) => article.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= featured.length) return articles
  const order = featured.map((article) => article.id)
  const [moved] = order.splice(index, 1)
  order.splice(target, 0, moved)
  const rank = new Map(order.map((articleId, position) => [articleId, position]))
  return articles.map((article) =>
    rank.has(article.id) ? { ...article, featuredOrder: rank.get(article.id) ?? article.featuredOrder } : article,
  )
}

export function thumbnailAlt(article: Pick<Article, 'title' | 'thumbnailAlt'>): string {
  const written = article.thumbnailAlt.trim()
  if (written) return written
  const title = article.title.trim()
  return title ? `Photograph for ${title}` : 'Article photograph'
}

export function authorName(authors: Author[], authorId: string): string {
  return authors.find((author) => author.id === authorId)?.name.trim() || 'An unnamed correspondent'
}
