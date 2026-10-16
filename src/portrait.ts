const portraitFiles = {
  ...import.meta.glob('../author-portraits/*-portrait.{jpg,jpeg,png,webp,gif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob('../author-portraits/????????-????-????-????-????????????.{jpg,jpeg,png,webp,gif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
}

const PORTRAIT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024
const MAX_EDGE = 480

export function portraitFileError(file: File): string | null {
  if (file.type && !PORTRAIT_TYPES.has(file.type)) return 'Use a JPEG, PNG, WebP, or GIF.'
  if (file.size > MAX_BYTES) return 'That portrait is larger than 8 MB. Choose a smaller file.'
  return null
}

export function portraitSlug(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function portraitFileUrl(author: { id: string; name: string }): string | null {
  const byName = `${portraitSlug(author.name)}-portrait.`
  const byId = `${author.id}.`
  let named: string | null = null
  let identified: string | null = null
  for (const [path, url] of Object.entries(portraitFiles)) {
    if (typeof url !== 'string') continue
    const file = path.split('/').pop() ?? ''
    if (file.startsWith(byId)) identified = url
    if (file.startsWith(byName)) named = url
  }
  return identified ?? named
}

export function portraitAlt(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `Portrait of ${trimmed}` : 'Author portrait'
}

export async function squarePortrait(file: File): Promise<Blob> {
  const problem = portraitFileError(file)
  if (problem) throw new Error(problem)
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const edge = Math.max(1, Math.min(MAX_EDGE, side))
    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const context = canvas.getContext('2d')
    if (!context) throw new Error('That portrait could not be prepared.')
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      edge,
      edge,
    )
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('That portrait could not be prepared.')
    return blob
  } finally {
    bitmap.close()
  }
}
