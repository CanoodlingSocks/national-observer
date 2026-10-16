import { Link, useParams } from 'react-router-dom'
import { authorName, excerpt, formatDate, thumbnailAlt, type Article } from '../model'
import { usePaper } from '../paper-context'
import { portraitAlt } from '../portrait'
import { useTitle } from '../useTitle'
import { Prose, StoredImage } from './Prose'

function alsoInThePaper(articles: Article[], current: Article) {
  const own = new Set(current.tags.map((tag) => tag.toLocaleLowerCase()))
  return articles
    .filter((item) => item.status === 'published' && item.id !== current.id)
    .sort((a, b) => {
      const score = (item: Article) => (item.tags.some((tag) => own.has(tag.toLocaleLowerCase())) ? 1 : 0)
      return score(b) - score(a) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
    })
    .slice(0, 4)
}

export function ArticlePage() {
  const { id } = useParams()
  const { articles, authors } = usePaper()
  const article = articles.find((item) => item.id === id && item.status === 'published')
  const author = authors.find((item) => item.id === article?.authorId)
  const others = article ? alsoInThePaper(articles, article) : []
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
    <article className={others.length > 0 ? 'sheet reading has-also' : 'sheet reading'}>
      <header className={article.thumbnailId ? 'article-head has-image' : 'article-head'}>
        {article.thumbnailId ? (
          <StoredImage
            id={article.thumbnailId}
            alt={thumbnailAlt(article)}
            className="article-hero"
            loading="eager"
          />
        ) : null}
        <div className="article-copy">
          {article.tags[0] ? <p className="kicker">{article.tags[0]}</p> : null}
          <h1 className="article-title">{article.title}</h1>
          {article.subtitle ? <p className="dek">{article.subtitle}</p> : null}
          <p className="byline">
            By <span className="byline-name">{authorName(authors, article.authorId)}</span>
            {' · '}
            <time dateTime={article.date}>{formatDate(article.date)}</time>
          </p>
        </div>
      </header>
      <Prose html={article.bodyHtml} />
      <section className="author-note" aria-labelledby="author-note-title">
        <h2 id="author-note-title">About the author</h2>
        <div className={author?.portraitId ? 'author-card has-portrait' : 'author-card'}>
          {author?.portraitId ? (
            <StoredImage
              id={author.portraitId}
              alt={portraitAlt(author.name)}
              className="author-portrait"
            />
          ) : null}
          <div className="author-copy">
            <p className="author-note-name">{author?.name.trim() || 'An unnamed correspondent'}</p>
            <p className="author-bio">{author?.bio.trim() || 'No biography is on file.'}</p>
          </div>
        </div>
      </section>
      {others.length > 0 ? (
        <aside className="also" aria-labelledby="also-title">
          <h2 id="also-title" className="section-title">
            Also in the paper
          </h2>
          <div className="row-list">
            {others.map((item) => (
              <article key={item.id} className={item.thumbnailId ? 'story-row has-image' : 'story-row'}>
                {item.thumbnailId ? (
                  <StoredImage
                    id={item.thumbnailId}
                    alt={thumbnailAlt(item)}
                    className="row-thumb"
                    loading="lazy"
                  />
                ) : null}
                <div className="story-copy">
                  <h3 className="story-title">
                    <Link to={`/article/${item.id}`}>{item.title}</Link>
                  </h3>
                  <p className="byline">
                    <span className="byline-name">{authorName(authors, item.authorId)}</span>
                  </p>
                  {excerpt(item.bodyHtml, 110) ? <p className="preview">{excerpt(item.bodyHtml, 110)}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </aside>
      ) : null}
    </article>
  )
}
