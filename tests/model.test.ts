import { describe, expect, it } from 'vitest'
import { parseBackup } from '../src/backup'
import { blankArticle, errorsForSave, excerpt, moveFeatured, paperSelection, publishErrors, statusForSave, type Article } from '../src/model'
import { sanitize } from '../src/sanitize'

function piece(patch: Partial<Article>): Article {
  return { ...blankArticle(patch.id ?? 'piece'), ...patch }
}

describe('publish rules', () => {
  it('blocks a featured piece that has no description', () => {
    const errors = publishErrors(piece({ title: 'Frogs', authorId: 'ada', date: '2026-10-09', featured: true, description: '  ' }))
    expect(errors.description).toMatch(/description/)
  })

  it('allows a piece that is not featured to publish without a description', () => {
    const errors = publishErrors(piece({ title: 'Frogs', authorId: 'ada', date: '2026-10-09', featured: false, description: '' }))
    expect(errors.description).toBeUndefined()
    expect(errors).toEqual({})
  })

  it('saves an unfinished draft without a headline or featured description', () => {
    const article = piece({ title: '  ', authorId: '', date: '', featured: true, description: '' })
    expect(errorsForSave('draft', article)).toEqual({})
    expect(statusForSave('draft')).toBe('draft')
    expect(errorsForSave('revert', article)).toEqual({})
    expect(statusForSave('revert')).toBe('draft')
  })

  it('requires a finished piece before it can be marked ready', () => {
    const errors = errorsForSave('ready', piece({ title: 'Frogs', authorId: '', date: '2026-10-09', featured: true, description: '' }))
    expect(errors.authorId).toMatch(/author/)
    expect(errors.description).toMatch(/description/)
    expect(statusForSave('ready')).toBe('ready')
    expect(statusForSave('publish')).toBe('published')
  })
})

describe('front page order', () => {
  it('keeps the chosen featured order', () => {
    const articles = [
      piece({ id: 'a', title: 'A', featured: true, featuredOrder: 0, status: 'published' }),
      piece({ id: 'b', title: 'B', featured: true, featuredOrder: 1, status: 'published' }),
      piece({ id: 'c', title: 'C', featured: false, status: 'published' }),
    ]
    const moved = moveFeatured(articles, 'b', -1)
    expect(paperSelection(moved, null).featured.map((article) => article.id)).toEqual(['b', 'a'])
    expect(paperSelection(moved, null).rows.map((article) => article.id)).toEqual(['c'])
  })

  it('hides drafts and ready pieces from the paper', () => {
    const articles = [
      piece({ id: 'a', title: 'A', status: 'draft', featured: true, featuredOrder: 0 }),
      piece({ id: 'b', title: 'B', status: 'ready', featured: true, featuredOrder: 1 }),
    ]
    expect(paperSelection(articles, null).featured).toEqual([])
    expect(paperSelection(articles, null).rows).toEqual([])
  })
})

describe('excerpt', () => {
  it('ends a shortened preview with an ellipsis', () => {
    const text = 'word '.repeat(80)
    expect(excerpt(`<p>${text}</p>`).endsWith('…')).toBe(true)
  })

  it('leaves a short preview unmarked', () => {
    expect(excerpt('<p>A short dispatch.</p>')).toBe('A short dispatch.')
  })
})

describe('sanitize and backup', () => {
  it('keeps an inline picture’s placement and drops anything else on it', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const clean = sanitize(
      `<p>Before <img data-image-id="${id}" alt="Lincoln at his desk" data-align="left" data-width="40" data-selected="true" style="width: 40%; height: 9px" onerror="alert(1)"> after</p>`,
    )
    expect(clean).toContain('data-align="left"')
    expect(clean).toContain('data-width="40"')
    expect(clean).toContain('width: 40%')
    expect(clean).toContain('alt="Lincoln at his desk"')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('height')
    expect(clean).not.toContain('data-selected')

    const unsafe = sanitize(`<img data-image-id="${id}" alt="" data-align="evil" data-width="1000" style="width: 1000%">`)
    expect(unsafe).not.toContain('data-align')
    expect(unsafe).not.toContain('data-width')
    expect(unsafe).not.toContain('style')
  })

  it('strips scripts and keeps formatting', () => {
    const clean = sanitize('<p style="text-align: center"><strong>Hold</strong> the line.</p><script>alert(1)</script>')
    expect(clean).toContain('<strong>Hold</strong>')
    expect(clean).toContain('text-align: center')
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('alert')
  })

  it('round-trips featured order in a backup', () => {
    const raw = JSON.stringify({
      version: 1,
      articles: [piece({ id: 'a', title: 'A', featured: true, featuredOrder: 3, status: 'published', bodyHtml: '<p>Hi</p>' })],
      authors: [{ id: 'ada', name: 'Ada', bio: 'Correspondent.' }],
      images: [],
      settings: { paper: 'The National Observer' },
    })
    const parsed = parseBackup(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.articles[0]?.featuredOrder).toBe(3)
    expect(parsed.backup.authors[0]?.name).toBe('Ada')
    expect(parsed.backup.authors[0]?.portraitId).toBeNull()
  })

  it('keeps a ready piece in a backup and rejects an unknown status', () => {
    const ready = JSON.stringify({
      version: 1,
      articles: [piece({ id: 'soon', title: 'Soon', status: 'ready', bodyHtml: '<p>Hold</p>' })],
      authors: [],
      images: [],
      settings: { paper: 'The National Observer' },
    })
    const parsed = parseBackup(ready)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.articles[0]?.status).toBe('ready')
    expect(parsed.backup.articles[0]?.bodyHtml).toBe('<p>Hold</p>')

    const unknown = ready.replace('"ready"', '"scheduled"')
    expect(parseBackup(unknown).ok).toBe(false)
  })
})
