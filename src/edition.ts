import { imageIdsForArticle, type Article, type Author } from './model'

export function selectPublished<T extends { id: string }>(input: {
  articles: Article[]
  authors: Author[]
  images: T[]
}): { articles: Article[]; authors: Author[]; images: T[] } {
  const articles = input.articles.filter((article) => article.status === 'published')
  const authors = input.authors.filter((author) => articles.some((article) => article.authorId === author.id))
  const imageIds = new Set(articles.flatMap((article) => imageIdsForArticle(article)))
  for (const author of authors) {
    if (author.portraitId) imageIds.add(author.portraitId)
  }
  return {
    articles,
    authors,
    images: input.images.filter((image) => imageIds.has(image.id)),
  }
}
