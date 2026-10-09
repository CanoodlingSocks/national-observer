import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QUOTA_MESSAGE, isQuotaError } from '../db'
import type { Author } from '../model'
import { usePaper } from '../paper'
import { portraitAlt, portraitFileError, squarePortrait } from '../portrait'
import { useTitle } from '../useTitle'
import { ConfirmDialog } from './Dialog'
import { StoredImage } from './Prose'

export function Authors() {
  useTitle('Authors — The National Observer')
  const { articles, authors, saveAuthor, removeAuthor, saveImage } = usePaper()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const portrait = usePortrait(null)
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
    try {
      const portraitId = await storePortrait(saveImage, name, null, portrait.pending)
      await saveAuthor({ id: crypto.randomUUID(), name: name.trim(), bio: bio.trim(), portraitId })
    } catch (caught) {
      setError(isQuotaError(caught) ? QUOTA_MESSAGE : 'The author could not be saved in this browser.')
      return
    }
    setName('')
    setBio('')
    portrait.clear()
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
        <PortraitField id="new-author-portrait" name={name} portrait={portrait} />
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
              saveImage={saveImage}
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
  saveImage,
  onDelete,
  onBlocked,
}: {
  author: Author
  linked: number
  onSave: (author: Author) => Promise<void>
  saveImage: (image: { id: string; alt: string; blob: Blob }) => Promise<void>
  onDelete: () => void
  onBlocked: (message: string) => void
}) {
  const [name, setName] = useState(author.name)
  const [bio, setBio] = useState(author.bio)
  const portrait = usePortrait(author.portraitId)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) {
      setError('Give the author a name before saving.')
      return
    }
    try {
      const portraitId = await storePortrait(saveImage, name, portrait.portraitId, portrait.pending)
      await onSave({ ...author, name: name.trim(), bio: bio.trim(), portraitId })
      portrait.commit(portraitId)
      setError('')
    } catch (caught) {
      setError(isQuotaError(caught) ? QUOTA_MESSAGE : 'The author could not be saved in this browser.')
    }
  }

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
        <PortraitField id={`author-${author.id}-portrait`} name={name} portrait={portrait} />
        {error ? <p className="field-error">{error}</p> : null}
        <p className="hint">
          {linked === 0 ? 'Not linked to a piece.' : `Linked to ${linked} ${linked === 1 ? 'piece' : 'pieces'}.`}
        </p>
        <div className="action-row">
          <button type="button" className="btn" onClick={() => void save()}>
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

type PortraitDraft = ReturnType<typeof usePortrait>

function usePortrait(initialId: string | null) {
  const [portraitId, setPortraitId] = useState<string | null>(initialId)
  const [pending, setPending] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const previewRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  function replacePreview(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreviewUrl(url)
  }

  async function choose(file: File) {
    const problem = portraitFileError(file)
    if (problem) {
      setError(problem)
      return
    }
    try {
      const blob = await squarePortrait(file)
      replacePreview(URL.createObjectURL(blob))
      setPending(blob)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That portrait could not be prepared.')
    }
  }

  function remove() {
    setPortraitId(null)
    setPending(null)
    replacePreview(null)
    setError('')
  }

  function clear() {
    remove()
  }

  function commit(nextId: string | null) {
    setPortraitId(nextId)
    setPending(null)
    replacePreview(null)
    setError('')
  }

  return { portraitId, pending, previewUrl, error, choose, remove, clear, commit }
}

async function storePortrait(
  saveImage: (image: { id: string; alt: string; blob: Blob }) => Promise<void>,
  name: string,
  portraitId: string | null,
  pending: Blob | null,
) {
  if (!pending) return portraitId ?? null
  const id = crypto.randomUUID()
  await saveImage({ id, alt: portraitAlt(name), blob: pending })
  return id
}

function PortraitField({ id, name, portrait }: { id: string; name: string; portrait: PortraitDraft }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showing = Boolean(portrait.previewUrl || portrait.portraitId)
  return (
    <fieldset className="thumb-field">
      <legend>Portrait</legend>
      <p id={`${id}-note`} className="hint">
        Optional. A square crop is saved with the author.
      </p>
      {portrait.previewUrl ? (
        <img className="portrait-preview" src={portrait.previewUrl} alt={portraitAlt(name)} />
      ) : portrait.portraitId ? (
        <StoredImage id={portrait.portraitId} alt={portraitAlt(name)} className="portrait-preview" />
      ) : null}
      <div className="action-row">
        <button type="button" className="btn" aria-describedby={`${id}-note`} onClick={() => inputRef.current?.click()}>
          {showing ? 'Replace portrait' : 'Choose portrait'}
        </button>
        {showing ? (
          <button type="button" className="btn" onClick={portrait.remove}>
            Remove portrait
          </button>
        ) : null}
      </div>
      {portrait.error ? <p className="field-error">{portrait.error}</p> : null}
      <input
        ref={inputRef}
        id={id}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void portrait.choose(file)
        }}
      />
    </fieldset>
  )
}
