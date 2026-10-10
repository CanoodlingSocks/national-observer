import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { QUOTA_MESSAGE, isQuotaError } from '../db'
import {
  blankArticle,
  errorsForSave,
  nextFeaturedOrder,
  parseTags,
  statusForSave,
  type Article,
  type FieldErrors,
  type SaveIntent,
} from '../model'
import { usePaper } from '../paper'
import { sanitize } from '../sanitize'
import { useTitle } from '../useTitle'
import { StoredImage } from './Prose'
import { RichText } from './RichText'

export function ArticleEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ready, articles, authors, saveArticle, saveAuthor, saveImage } = usePaper()
  const [draft, setDraft] = useState<Article | null>(null)
  const [tagText, setTagText] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState<SaveIntent | null>(null)
  const [addingAuthor, setAddingAuthor] = useState(false)
  const [newAuthorName, setNewAuthorName] = useState('')
  const [newAuthorBio, setNewAuthorBio] = useState('')
  const [authorError, setAuthorError] = useState('')
  const thumbRef = useRef<HTMLInputElement>(null)
  const saved = useRef('')
  const allowLeave = useRef(false)
  const seeded = useRef<string | null>(null)
  const draftRef = useRef<Article | null>(null)
  const tagRef = useRef('')

  draftRef.current = draft
  tagRef.current = tagText
  useTitle(draft?.title.trim() ? `${draft.title.trim()} — The desk` : 'New piece — The National Observer')

  useEffect(() => {
    if (!ready || !id || seeded.current === id) return
    seeded.current = id
    const existing = articles.find((item) => item.id === id) ?? blankArticle(id)
    const tags = existing.tags.join(', ')
    setDraft(existing)
    setTagText(tags)
    saved.current = JSON.stringify({ article: existing, tags })
    allowLeave.current = false
    setErrors({})
    setStatus('')
    setFormError('')
  }, [ready, id, articles])

  const blocker = useBlocker(() => {
    if (allowLeave.current || !draftRef.current) return false
    return JSON.stringify({ article: draftRef.current, tags: tagRef.current }) !== saved.current
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm('Leave without saving this piece?')
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!draftRef.current) return
      if (JSON.stringify({ article: draftRef.current, tags: tagRef.current }) !== saved.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  if (!id) {
    return (
      <div className="sheet desk">
        <h1>This piece is not on the desk.</h1>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="sheet desk">
        <p role="status">Opening the piece…</p>
      </div>
    )
  }

  const stored = articles.find((item) => item.id === draft.id)
  const canRevert = draft.status === 'ready' || draft.status === 'published'

  function update(patch: Partial<Article>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setStatus('')
  }

  async function addAuthor() {
    if (!newAuthorName.trim()) {
      setAuthorError('Give the author a name before saving.')
      document.getElementById('inline-author-name')?.focus()
      return
    }
    const author = { id: crypto.randomUUID(), name: newAuthorName.trim(), bio: newAuthorBio.trim(), portraitId: null }
    try {
      await saveAuthor(author)
    } catch {
      setAuthorError('The author could not be saved.')
      return
    }
    update({ authorId: author.id })
    setNewAuthorName('')
    setNewAuthorBio('')
    setAuthorError('')
    setAddingAuthor(false)
  }

  async function onThumbnail(file: File) {
    const imageId = crypto.randomUUID()
    try {
      await saveImage({ id: imageId, alt: draft?.thumbnailAlt ?? '', blob: file })
    } catch (error) {
      setFormError(isQuotaError(error) ? QUOTA_MESSAGE : 'The thumbnail could not be saved in this browser.')
      return
    }
    update({ thumbnailId: imageId })
  }

  async function persist(intent: SaveIntent) {
    if (!draft) return
    const featuredOrder = draft.featured
      ? stored?.featured
        ? stored.featuredOrder
        : nextFeaturedOrder(articles.filter((item) => item.id !== draft.id))
      : draft.featuredOrder
    const article: Article = {
      ...draft,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      description: draft.description.trim(),
      thumbnailAlt: draft.thumbnailAlt.trim(),
      tags: parseTags(tagText),
      bodyHtml: sanitize(draft.bodyHtml),
      status: statusForSave(intent),
      featuredOrder,
      updatedAt: new Date().toISOString(),
    }
    const nextErrors = errorsForSave(intent, article)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError(
        intent === 'publish'
          ? 'The piece cannot be published yet.'
          : 'The piece cannot be marked ready yet.',
      )
      setStatus('')
      const first = Object.keys(nextErrors)[0]
      document.getElementById(first)?.focus()
      return
    }
    setSaving(intent)
    setFormError('')
    try {
      await saveArticle(article)
      const tags = article.tags.join(', ')
      setDraft(article)
      setTagText(tags)
      saved.current = JSON.stringify({ article, tags })
      if (intent === 'publish') {
        allowLeave.current = true
        navigate(`/article/${article.id}`)
        return
      }
      setStatus(
        intent === 'revert'
          ? 'Returned to draft. It is off the paper.'
          : intent === 'ready'
            ? 'Marked ready. It stays off the paper until you publish it.'
            : 'Saved as a draft.',
      )
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The piece could not be saved.')
    } finally {
      setSaving(null)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
    const intent: SaveIntent = value === 'publish' ? 'publish' : value === 'ready' ? 'ready' : 'draft'
    void persist(intent)
  }

  return (
    <div className="sheet desk">
      <p className="back-link">
        <Link className="read-more" to="/desk">
          Back to the desk
        </Link>
      </p>
      <h1>{stored ? 'Edit piece' : 'New piece'}</h1>
      <form className="editor-form" noValidate onSubmit={onSubmit}>
        {formError ? (
          <div role="alert" className="form-alert">
            <p>{formError}</p>
            {Object.keys(errors).length > 0 ? (
              <ul>
                {Object.entries(errors).map(([key, message]) => (
                  <li key={key}>
                    <a href={`#${key}`}>{message}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Field id="title" label="Headline" error={errors.title}>
          <input
            id="title"
            value={draft.title}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'title-note' : undefined}
            onChange={(event) => update({ title: event.target.value })}
          />
        </Field>
        <Field id="subtitle" label="Subtitle">
          <input id="subtitle" value={draft.subtitle} onChange={(event) => update({ subtitle: event.target.value })} />
        </Field>
        <Field id="authorId" label="Author" error={errors.authorId}>
          <select
            id="authorId"
            value={draft.authorId}
            aria-invalid={errors.authorId ? true : undefined}
            aria-describedby={errors.authorId ? 'authorId-note' : undefined}
            onChange={(event) => update({ authorId: event.target.value })}
          >
            <option value="">Choose an author</option>
            {authors
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
          </select>
        </Field>
        {addingAuthor ? (
          <div className="inline-author">
            <div className="field">
              <label htmlFor="inline-author-name">Name</label>
              <input
                id="inline-author-name"
                value={newAuthorName}
                aria-invalid={authorError ? true : undefined}
                onChange={(event) => {
                  setNewAuthorName(event.target.value)
                  setAuthorError('')
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="inline-author-bio">Biography</label>
              <textarea id="inline-author-bio" value={newAuthorBio} onChange={(event) => setNewAuthorBio(event.target.value)} />
            </div>
            {authorError ? <p className="field-error">{authorError}</p> : null}
            <div className="action-row">
              <button type="button" className="btn btn-primary" onClick={() => void addAuthor()}>
                Save author
              </button>
              <button type="button" className="btn" onClick={() => setAddingAuthor(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p>
            <button type="button" className="btn" onClick={() => setAddingAuthor(true)}>
              Add an author
            </button>
          </p>
        )}
        <Field id="date" label="Date" error={errors.date}>
          <input
            id="date"
            type="date"
            value={draft.date}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={errors.date ? 'date-note' : undefined}
            onChange={(event) => update({ date: event.target.value })}
          />
        </Field>
        <div className="check">
          <input
            id="featured"
            type="checkbox"
            checked={draft.featured}
            onChange={(event) => update({ featured: event.target.checked })}
          />
          <label htmlFor="featured">Show on the front page as a featured article</label>
        </div>
        <Field
          id="description"
          label="Description"
          error={errors.description}
          hint="Required to mark a featured piece ready or to publish it. Other pieces can omit it."
        >
          <textarea
            id="description"
            value={draft.description}
            aria-required={draft.featured || undefined}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="description-note"
            onChange={(event) => update({ description: event.target.value })}
          />
        </Field>
        <Field id="tags" label="Tags" hint="Separate tags with commas.">
          <input
            id="tags"
            value={tagText}
            aria-describedby="tags-note"
            onChange={(event) => {
              setTagText(event.target.value)
              setStatus('')
            }}
          />
        </Field>
        <fieldset className="thumb-field">
          <legend>Thumbnail</legend>
          <div className="field">
            <label htmlFor="thumbnailAlt">Thumbnail description</label>
            <input
              id="thumbnailAlt"
              value={draft.thumbnailAlt}
              onChange={(event) => update({ thumbnailAlt: event.target.value })}
            />
          </div>
          {draft.thumbnailId ? (
            <StoredImage id={draft.thumbnailId} alt={draft.thumbnailAlt || 'Chosen thumbnail'} className="editor-thumb" />
          ) : null}
          <div className="action-row">
            <button type="button" className="btn" onClick={() => thumbRef.current?.click()}>
              Choose thumbnail
            </button>
            {draft.thumbnailId ? (
              <button type="button" className="btn" onClick={() => update({ thumbnailId: null })}>
                Remove thumbnail
              </button>
            ) : null}
          </div>
          <input
            ref={thumbRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void onThumbnail(file)
            }}
          />
        </fieldset>
        <RichText resetKey={draft.id} initialHtml={draft.bodyHtml} onChange={(bodyHtml) => update({ bodyHtml })} />
        <div className="action-row">
          <button type="submit" className="btn" name="intent" value="draft" disabled={saving !== null} data-state={saving === 'draft' ? 'loading' : undefined}>
            {saving === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="submit" className="btn" name="intent" value="ready" disabled={saving !== null} data-state={saving === 'ready' ? 'loading' : undefined}>
            {saving === 'ready' ? 'Saving…' : 'Mark ready'}
          </button>
          <button type="submit" className="btn btn-primary" name="intent" value="publish" disabled={saving !== null} data-state={saving === 'publish' ? 'loading' : undefined}>
            {saving === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
          {canRevert ? (
            <button type="button" className="btn" disabled={saving !== null} onClick={() => void persist('revert')}>
              {saving === 'revert' ? 'Saving…' : 'Return to draft'}
            </button>
          ) : null}
        </div>
        {status ? <p role="status">{status}</p> : null}
      </form>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  const note = error || hint
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <p id={`${id}-note`} className={error ? 'field-error' : 'hint'} aria-hidden={note ? undefined : true}>
        {note || '\u00a0'}
      </p>
    </div>
  )
}
