import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseBackup, type Backup } from '../backup'
import { authorName, byFeaturedOrder, formatDate } from '../model'
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

  const featured = articles.filter((article) => article.featured).slice().sort(byFeaturedOrder)
  const pieces = articles.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
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
        This desk is off the paper. Visitors never see drafts. A piece appears only after you publish it.
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
        Download published edition writes edition.json for the public site. It leaves drafts and the rest of this browser’s paper alone.
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
                    Front page {index + 1}
                    {article.status === 'draft' ? ' · Draft' : ''}
                  </p>
                  <h3 className="story-title">{article.title || 'Untitled'}</h3>
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
          <ul className="desk-list">
            {pieces.map((article) => (
              <li key={article.id} className="desk-item">
                <div className="desk-copy">
                  <p className="desk-kicker">
                    {article.status === 'published' ? 'Published' : 'Draft'}
                    {article.featured ? ' · Featured' : ''}
                    {' · '}
                    {formatDate(article.date)}
                  </p>
                  <h3 className="story-title">{article.title || 'Untitled'}</h3>
                  <p className="byline">{authorName(authors, article.authorId)}</p>
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
            ))}
          </ul>
        )}
      </section>

      {deleting ? (
        <ConfirmDialog
          title="Delete this article?"
          body={`“${deleting.title || 'Untitled'}” and its place on the front page will be removed.`}
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
