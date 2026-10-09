import { Link, useParams } from 'react-router-dom'
import { authorName, formatDate } from '../model'
import { usePaper } from '../paper-context'
import { useTitle } from '../useTitle'
import { Prose } from './Prose'

export function ArticlePage() {
  const { id } = useParams()
  const { articles, authors } = usePaper()
  const article = articles.find((item) => item.id === id && item.status === 'published')
  const author = authors.find((item) => item.id === article?.authorId)
  useTitle(article ? `${article.title} — The National Observer` : 'Not on the paper — The National Observer')

  if (!article) {
    return (
      <div className="sheet reading">
        <h1>This piece is not on the paper.</h1>
        <p>
          <Link className="read-more" to="/">
            Back to the paper
          </Link>
        </p>
      </div>
    )
  }

  return (
    <article className="sheet reading">
      <header className="article-head">
        <h1 className="article-title">{article.title}</h1>
        {article.subtitle ? <p className="dek">{article.subtitle}</p> : null}
        <p className="byline">
          By {authorName(authors, article.authorId)}
          {' · '}
          <time dateTime={article.date}>{formatDate(article.date)}</time>
        </p>
      </header>
      <Prose html={article.bodyHtml} />
      <section className="author-note" aria-labelledby="author-note-title">
        <h2 id="author-note-title">About the author</h2>
        <p className="author-note-name">{author?.name.trim() || 'An unnamed correspondent'}</p>
        <p className="author-bio">{author?.bio.trim() || 'No biography is on file.'}</p>
      </section>
    </article>
  )
}
