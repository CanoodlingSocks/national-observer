import { describe, expect, it } from 'vitest'
import { parseBackup } from '../src/backup'
import { blankArticle, excerpt, moveFeatured, paperSelection, publishErrors, type Article } from '../src/model'
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

  it('hides drafts from the paper', () => {
    const articles = [piece({ id: 'a', title: 'A', status: 'draft', featured: true, featuredOrder: 0 })]
    expect(paperSelection(articles, null).featured).toEqual([])
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
})
