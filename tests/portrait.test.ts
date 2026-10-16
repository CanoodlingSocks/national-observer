import { describe, expect, it } from 'vitest'
import { bytesToBase64, imagesFromBackup, parseBackup } from '../src/backup'
import { portraitAlt, portraitFileError, portraitFileUrl, portraitSlug } from '../src/portrait'

describe('author portraits', () => {
  it('names the portrait from the author', () => {
    expect(portraitAlt(' Ada ')).toBe('Portrait of Ada')
    expect(portraitAlt('  ')).toBe('Author portrait')
  })

  it('finds a photograph from the columnist’s name, and leaves other files alone', () => {
    expect(portraitSlug('Lincoln Windsor Aircors')).toBe('lincoln-windsor-aircors')
    expect(portraitSlug('Biddy G. Ossip')).toBe('biddy-g-ossip')
    expect(portraitFileUrl({ id: 'not-published', name: 'Lincoln Windsor Aircors' })).toMatch(/lincoln-windsor-aircors-portrait/)
    expect(portraitFileUrl({ id: 'not-published', name: 'Lincoln Windsor Aircors' })).not.toMatch(/sitting-at-desk/)
    expect(portraitFileUrl({ id: '1505709b-7d38-47bd-812d-d7a4bfdec35e', name: 'No such columnist' })).toBeNull()
  })

  it('rejects unsupported or oversized files', () => {
    expect(portraitFileError(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toMatch(/JPEG/)
    expect(portraitFileError(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' }))).toMatch(/8 MB/)
    expect(portraitFileError(new File(['x'], 'face.jpg', { type: 'image/jpeg' }))).toBeNull()
  })

  it('keeps a portrait through a backup', async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4])
    const parsed = parseBackup(
      JSON.stringify({
        version: 1,
        articles: [],
        authors: [{ id: 'ada', name: 'Ada', bio: 'Files the late copy.', portraitId: 'face' }],
        images: [{ id: 'face', alt: 'Portrait of Ada', type: 'image/jpeg', data: bytesToBase64(bytes) }],
        settings: { paper: 'The National Observer' },
      }),
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.authors[0]?.portraitId).toBe('face')
    expect(parsed.backup.images[0]?.data).toBe(bytesToBase64(bytes))
    const [image] = imagesFromBackup(parsed.backup.images)
    expect(image?.id).toBe('face')
    expect(image?.alt).toBe('Portrait of Ada')
    expect(image?.blob.type).toBe('image/jpeg')
  })
})
