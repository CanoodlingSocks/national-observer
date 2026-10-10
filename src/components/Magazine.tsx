import { Link, useSearchParams } from 'react-router-dom'
import { authorName, excerpt, paperSelection, thumbnailAlt, type Article } from '../model'
import { usePaper } from '../paper-context'
import { useTitle } from '../useTitle'
import { StoredImage } from './Prose'

export function Magazine() {
  useTitle('The National Observer')
  const { articles, authors } = usePaper()
  const [params, setParams] = useSearchParams()
  const tag = params.get('tag')
  const selection = paperSelection(articles, tag)
  const published = articles.some((article) => article.status === 'published')

  function selectTag(next: string | null) {
    if (next) setParams({ tag: next })
    else setParams({})
  }

  return (
    <div className="sheet paper">
      {selection.tags.length > 0 ? (
        <div className="tag-row" role="group" aria-label="Tags">
          <button type="button" className="tag-btn" aria-pressed={!tag} onClick={() => selectTag(null)}>
            All
          </button>
          {selection.tags.map((item) => (
            <button
              key={item}
              type="button"
              className="tag-btn"
              aria-pressed={tag?.toLocaleLowerCase() === item.toLocaleLowerCase()}
              onClick={() => selectTag(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {tag ? <p className="filter-status">Showing pieces tagged {tag}.</p> : null}
      {!published ? (
        <section className="empty">
          <h2>No dispatches have been published.</h2>
          <p>The paper prints what you publish from the desk.</p>
        </section>
      ) : selection.featured.length === 0 && selection.rows.length === 0 ? (
        <section className="empty">
          <h2>Nothing on the paper carries that tag.</h2>
          <p>Choose another tag, or return to the whole paper.</p>
        </section>
      ) : (
        <>
          {selection.featured.length > 0 ? (
            <section className="paper-section" aria-labelledby="front-page-title">
              <h2 id="front-page-title" className="section-title">
                Front page
              </h2>
              <div className="featured-list">
                {selection.featured.map((article, index) => (
                  <FeaturedStory
                    key={article.id}
                    article={article}
                    lead={index === 0}
                    author={authorName(authors, article.authorId)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {selection.rows.length > 0 ? (
            <section className="paper-section" aria-labelledby="rest-title">
              <h2 id="rest-title" className="section-title">
                The rest of the paper
              </h2>
              <div className="row-list">
                {selection.rows.map((article) => (
                  <article key={article.id} className={article.thumbnailId ? 'story-row has-image' : 'story-row'}>
                    {article.thumbnailId ? (
                      <StoredImage
                        id={article.thumbnailId}
                        alt={thumbnailAlt(article)}
                        className="row-thumb"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="story-copy">
                      <h3 className="story-title">
                        <Link to={`/article/${article.id}`}>{article.title}</Link>
                      </h3>
                      <p className="byline">
                        <span className="byline-name">{authorName(authors, article.authorId)}</span>
                      </p>
                      {excerpt(article.bodyHtml) ? <p className="preview">{excerpt(article.bodyHtml)}</p> : null}
                      <p className="more">
                        <Link className="read-more" to={`/article/${article.id}`}>
                          Read more<span className="visually-hidden">: {article.title}</span>
                        </Link>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function FeaturedStory({ article, lead, author }: { article: Article; lead: boolean; author: string }) {
  return (
    <article className={lead ? `lead${article.thumbnailId ? ' has-image' : ''}` : `featured-row${article.thumbnailId ? ' has-image' : ''}`}>
      <div className="story-copy">
        <h3 className={lead ? 'story-title lead-title' : 'story-title'}>
          <Link to={`/article/${article.id}`}>{article.title}</Link>
        </h3>
        <p className="byline">
          <span className="byline-name">{author}</span>
        </p>
        {article.description ? <p className="dek">{article.description}</p> : null}
        <p className="more">
          <Link className="read-more" to={`/article/${article.id}`}>
            Read more<span className="visually-hidden">: {article.title}</span>
          </Link>
        </p>
      </div>
      {article.thumbnailId ? (
        <StoredImage
          id={article.thumbnailId}
          alt={thumbnailAlt(article)}
          className={lead ? 'lead-thumb' : 'row-thumb'}
          loading={lead ? 'eager' : 'lazy'}
        />
      ) : null}
    </article>
  )
}
