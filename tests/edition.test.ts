import { describe, expect, it } from 'vitest'
import { selectPublished } from '../src/edition'
import { blankArticle, type Article, type Author } from '../src/model'

function piece(patch: Partial<Article>): Article {
  return { ...blankArticle(patch.id ?? 'piece'), ...patch }
}

const ada: Author = { id: 'ada', name: 'Ada', bio: 'Files the late copy.' }
const bo: Author = { id: 'bo', name: 'Bo', bio: 'Still in the drawer.' }

describe('published edition', () => {
  it('keeps published articles, their authors, images, tags, and front-page order', () => {
    const articles = [
      piece({
        id: 'draft',
        title: 'Still in the drawer',
        authorId: 'bo',
        status: 'draft',
        featured: true,
        featuredOrder: 0,
        tags: ['Secret'],
        thumbnailId: 'draft-thumb',
        bodyHtml: '<p><img data-image-id="draft-body" alt="notes"></p>',
      }),
      piece({
        id: 'lead',
        title: 'The reservoir',
        authorId: 'ada',
        status: 'published',
        featured: true,
        featuredOrder: 2,
        tags: ['County', 'Water'],
        thumbnailId: 'lead-thumb',
        bodyHtml: '<p>She was <strong>serious</strong>. <img data-image-id="lead-body" alt="dusk"></p>',
      }),
      piece({
        id: 'row',
        title: 'The minutes',
        authorId: 'ada',
        status: 'published',
        featured: true,
        featuredOrder: 0,
        tags: ['County'],
        bodyHtml: '<p>Filed late.</p>',
      }),
    ]
    const images = [{ id: 'draft-thumb' }, { id: 'draft-body' }, { id: 'lead-thumb' }, { id: 'lead-body' }, { id: 'unused' }]
    const edition = selectPublished({ articles, authors: [ada, bo], images })

    expect(edition.articles.map((article) => article.id)).toEqual(['lead', 'row'])
    expect(edition.articles.map((article) => article.featuredOrder)).toEqual([2, 0])
    expect(edition.articles[0]?.tags).toEqual(['County', 'Water'])
    expect(edition.articles[0]?.bodyHtml).toContain('<strong>serious</strong>')
    expect(edition.authors).toEqual([ada])
    expect(edition.images.map((image) => image.id)).toEqual(['lead-thumb', 'lead-body'])
    expect(articles).toHaveLength(3)
    expect(images).toHaveLength(5)
  })

  it('is empty when nothing has been published', () => {
    const articles = [piece({ id: 'draft', title: 'Notes', authorId: 'bo', status: 'draft' })]
    const edition = selectPublished({ articles, authors: [bo], images: [{ id: 'sketch' }] })
    expect(edition).toEqual({ articles: [], authors: [], images: [] })
  })
})
