import { imageIdsForArticle, type Article, type Author } from './model'

export function selectPublished<T extends { id: string }>(input: {
  articles: Article[]
  authors: Author[]
  images: T[]
}): { articles: Article[]; authors: Author[]; images: T[] } {
  const articles = input.articles.filter((article) => article.status === 'published')
  const authorIds = new Set(articles.map((article) => article.authorId).filter(Boolean))
  const imageIds = new Set(articles.flatMap((article) => imageIdsForArticle(article)))
  return {
    articles,
    authors: input.authors.filter((author) => authorIds.has(author.id)),
    images: input.images.filter((image) => imageIds.has(image.id)),
  }
}
