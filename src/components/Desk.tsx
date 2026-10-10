import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseBackup, type Backup } from '../backup'
import { authorName, byFeaturedOrder, formatEdited, pieceTitle, statusLabel, type ArticleStatus } from '../model'
import { usePaper } from '../paper'
import { useTitle } from '../useTitle'
import { ConfirmDialog } from './Dialog'

export function Desk() {
  useTitle('The desk — The National Observer')
  const navigate = useNavigate()
  const { articles, authors, removeArticle, reorderFeatured, exportPaper, exportEdition, importPaper } = usePaper()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingBackup, setPendingBackup] = useState<Backup | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [filter, setFilter] = useState<DeskFilter>('all')

  const featured = articles.filter((article) => article.featured).slice().sort(byFeaturedOrder)
  const pieces = articles.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
  const visible = filter === 'all' ? pieces : pieces.filter((article) => article.status === filter)
  const deleting = articles.find((article) => article.id === pendingDelete)

  async function onImportFile(file: File) {
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      setError(parsed.error)
      setStatus('')
      return
    }
    setError('')
    setPendingBackup(parsed.backup)
  }

  return (
    <div className="sheet desk">
      <h1>The desk</h1>
      <p className="lede">
        This desk is off the paper. An empty browser starts with the pieces in public/edition.json, so you can edit or delete them here. Later changes stay in this browser. Publishing, editing, or deleting does not update the public website until you download a new edition.
      </p>
      <p className="warning">Clearing this browser’s data erases the paper unless you have exported a backup.</p>
      <div className="action-row">
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/desk/article/${crypto.randomUUID()}`)}>
          New piece
        </button>
        <Link className="btn" to="/desk/authors">
          Authors
        </Link>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void exportPaper().then(
              () => {
                setError('')
              },
              () => setError('The backup could not be exported.'),
            )
          }}
        >
          Export backup
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void exportEdition().then(
              () => {
                setError('')
                setStatus('Published edition downloaded. Nothing stored in this browser was changed.')
              },
              () => setError('The published edition could not be downloaded.'),
            )
          }}
        >
          Download published edition
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onImportFile(file)
          }}
        />
      </div>
      <p className="hint">
        Downloading an edition does not update the public website. It writes edition.json on your computer and leaves this browser’s paper alone. Replace public/edition.json, then push that file to main.
      </p>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      {status ? <p role="status">{status}</p> : null}

      <section className="desk-section" aria-labelledby="order-title">
        <h2 id="order-title" className="section-title">
          Front page order
        </h2>
        {featured.length === 0 ? (
          <p>No featured pieces. Mark a piece as featured while editing it.</p>
        ) : (
          <ul className="desk-list">
            {featured.map((article, index) => (
              <li key={article.id} className="desk-item">
                <div className="desk-copy">
                  <p className="desk-kicker">
                    Front page {index + 1} · {statusLabel(article.status)}
                  </p>
                  <h3 className="story-title">{pieceTitle(article)}</h3>
                </div>
                <div className="action-row">
                  {index > 0 ? (
                    <button type="button" className="btn" onClick={() => void reorderFeatured(article.id, -1).catch(() => setError('The front-page order could not be saved.'))}>
                      Move earlier
                    </button>
                  ) : null}
                  {index < featured.length - 1 ? (
                    <button type="button" className="btn" onClick={() => void reorderFeatured(article.id, 1).catch(() => setError('The front-page order could not be saved.'))}>
                      Move later
                    </button>
                  ) : null}
                  <Link className="btn" to={`/desk/article/${article.id}`}>
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="desk-section" aria-labelledby="pieces-title">
        <h2 id="pieces-title" className="section-title">
          All pieces
        </h2>
        {pieces.length === 0 ? (
          <div className="empty">
            <p>No pieces on the desk.</p>
            <p>A piece stays off the paper until you publish it.</p>
          </div>
        ) : (
          <>
            <div className="tag-row" role="group" aria-label="Article status">
              {deskFilters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tag-btn"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <p>{emptyFilterCopy(filter)}</p>
            ) : (
              <ul className="desk-list">
                {visible.map((article) => {
                  const edited = formatEdited(article.updatedAt)
                  const author = article.authorId ? authorName(authors, article.authorId) : ''
                  return (
                    <li key={article.id} className="desk-item">
                      <div className="desk-copy">
                        <p className="desk-kicker">
                          {statusLabel(article.status)}
                          {article.featured ? ' · Featured' : ''}
                          {edited ? ` · Last edited ${edited}` : ''}
                        </p>
                        <h3 className="story-title">{pieceTitle(article)}</h3>
                        {author ? <p className="byline">{author}</p> : null}
                      </div>
                      <div className="action-row">
                        <Link className="btn" to={`/desk/article/${article.id}`}>
                          Edit
                        </Link>
                        <button type="button" className="btn" onClick={() => setPendingDelete(article.id)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {deleting ? (
        <ConfirmDialog
          title="Delete this article?"
          body={`“${pieceTitle(deleting)}” and its place on the front page will be removed.`}
          cancelLabel="Keep article"
          confirmLabel="Delete article"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = deleting.id
            setPendingDelete(null)
            void removeArticle(id).catch(() => setError('The article could not be deleted.'))
          }}
        />
      ) : null}
      {pendingBackup ? (
        <ConfirmDialog
          title="Replace the paper?"
          body="Importing replaces every article, author, and image in this browser."
          cancelLabel="Keep current paper"
          confirmLabel="Import backup"
          onClose={() => setPendingBackup(null)}
          onConfirm={() => {
            const backup = pendingBackup
            setPendingBackup(null)
            void importPaper(backup).then(
              () => {
                setError('')
                setStatus('Backup imported. Articles, authors, images, and front-page order are restored.')
              },
              () => setError('The backup could not be imported.'),
            )
          }}
        />
      ) : null}
    </div>
  )
}

type DeskFilter = 'all' | ArticleStatus

const deskFilters: { id: DeskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'ready', label: 'Ready' },
  { id: 'published', label: 'Published' },
]

function emptyFilterCopy(filter: DeskFilter): string {
  if (filter === 'draft') return 'No drafts on the desk.'
  if (filter === 'ready') return 'No pieces are marked ready.'
  if (filter === 'published') return 'No pieces are published in this browser.'
  return 'No pieces on the desk.'
}
