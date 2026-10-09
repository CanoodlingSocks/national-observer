import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Author } from '../model'
import { usePaper } from '../paper'
import { useTitle } from '../useTitle'
import { ConfirmDialog } from './Dialog'

export function Authors() {
  useTitle('Authors — The National Observer')
  const { articles, authors, saveAuthor, removeAuthor } = usePaper()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState('')
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState<Author | null>(null)

  async function createAuthor() {
    if (!name.trim()) {
      setError('Give the author a name before saving.')
      document.getElementById('new-author-name')?.focus()
      return
    }
    await saveAuthor({ id: crypto.randomUUID(), name: name.trim(), bio: bio.trim() })
    setName('')
    setBio('')
    setError('')
    setStatus('Author saved.')
  }

  const ordered = authors.slice().sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="sheet desk">
      <p className="back-link">
        <Link className="read-more" to="/desk">
          Back to the desk
        </Link>
      </p>
      <h1>Authors</h1>
      <p className="lede">Authors sign the pieces you publish. Their biography prints at the end of each article.</p>
      <div className="stack-form">
        <div className="field">
          <label htmlFor="new-author-name">Name</label>
          <input
            id="new-author-name"
            value={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'new-author-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
          />
          {error ? (
            <p id="new-author-error" className="field-error">
              {error}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="new-author-bio">Biography</label>
          <textarea id="new-author-bio" value={bio} onChange={(event) => setBio(event.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void createAuthor()}>
          Save author
        </button>
      </div>
      {status ? <p role="status">{status}</p> : null}
      {ordered.length === 0 ? (
        <section className="empty">
          <h2>No authors yet.</h2>
          <p>Add an author before you publish a piece.</p>
        </section>
      ) : (
        <ul className="desk-list">
          {ordered.map((author) => (
            <AuthorRow
              key={author.id}
              author={author}
              linked={articles.filter((article) => article.authorId === author.id).length}
              onSave={saveAuthor}
              onDelete={() => {
                setBlocked('')
                setPending(author)
              }}
              onBlocked={setBlocked}
            />
          ))}
        </ul>
      )}
      {blocked ? (
        <p role="alert" className="field-error">
          {blocked}
        </p>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title="Delete this author?"
          body={`“${pending.name}” will be removed from the desk.`}
          cancelLabel="Keep author"
          confirmLabel="Delete author"
          onClose={() => setPending(null)}
          onConfirm={() => {
            const author = pending
            const linked = articles.filter((article) => article.authorId === author.id).length
            setPending(null)
            if (linked > 0) {
              setBlocked(
                `This author is linked to ${linked} ${linked === 1 ? 'piece' : 'pieces'}. Reassign those pieces before deleting the author.`,
              )
              return
            }
            void removeAuthor(author.id).catch(() => setError('The author could not be deleted.'))
          }}
        />
      ) : null}
    </div>
  )
}

function AuthorRow({
  author,
  linked,
  onSave,
  onDelete,
  onBlocked,
}: {
  author: Author
  linked: number
  onSave: (author: Author) => Promise<void>
  onDelete: () => void
  onBlocked: (message: string) => void
}) {
  const [name, setName] = useState(author.name)
  const [bio, setBio] = useState(author.bio)
  const [error, setError] = useState('')

  return (
    <li className="desk-item">
      <div className="stack-form">
        <div className="field">
          <label htmlFor={`author-${author.id}-name`}>Name</label>
          <input id={`author-${author.id}-name`} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`author-${author.id}-bio`}>Biography</label>
          <textarea id={`author-${author.id}-bio`} value={bio} onChange={(event) => setBio(event.target.value)} />
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        <p className="hint">
          {linked === 0 ? 'Not linked to a piece.' : `Linked to ${linked} ${linked === 1 ? 'piece' : 'pieces'}.`}
        </p>
        <div className="action-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!name.trim()) {
                setError('Give the author a name before saving.')
                return
              }
              void onSave({ ...author, name: name.trim(), bio: bio.trim() })
              setError('')
            }}
          >
            Save changes
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (linked > 0) {
                onBlocked(
                  `This author is linked to ${linked} ${linked === 1 ? 'piece' : 'pieces'}. Reassign those pieces before deleting the author.`,
                )
                return
              }
              onDelete()
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}
