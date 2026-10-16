const BLOCKS = new Set(['P', 'DIV', 'BLOCKQUOTE', 'LI'])

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function plainTextToHtml(text: string): string {
  const blocks = text.replaceAll('\r\n', '\n').split(/\n{2,}/)
  return blocks
    .map((block) => `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`)
    .join('')
}

function allowedHref(value: string): string | null {
  const href = value.trim()
  if (/^https?:\/\//i.test(href)) return href
  if (/^mailto:/i.test(href)) return href
  return null
}

function textAlign(element: HTMLElement): string | null {
  const align = element.style.textAlign
  if (align === 'left' || align === 'center' || align === 'right') return align
  return null
}

function indentLevel(element: HTMLElement): string | null {
  const level = element.dataset.indent
  if (level === '1' || level === '2' || level === '3') return level
  return null
}

function imageAlign(value: string | null): 'left' | 'right' | 'center' | null {
  if (value === 'left' || value === 'right' || value === 'center') return value
  return null
}

function imageWidth(value: string | null): number | null {
  if (!value || !/^\d{2,3}$/.test(value)) return null
  const width = Number(value)
  if (width < 20 || width > 100) return null
  return width
}

function appendClean(parent: HTMLElement, element: HTMLElement, doc: Document) {
  ;[...element.childNodes].flatMap((child) => clean(child, doc)).forEach((child) => parent.appendChild(child))
}

function clean(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [doc.createTextNode(node.textContent ?? '')]
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as HTMLElement
  const tag = element.tagName

  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME') return []
  if (tag === 'BR') return [doc.createElement('br')]

  if (tag === 'B' || tag === 'STRONG' || (tag === 'SPAN' && (element.style.fontWeight === 'bold' || element.style.fontWeight === '700'))) {
    const strong = doc.createElement('strong')
    appendClean(strong, element, doc)
    return [strong]
  }

  if (tag === 'I' || tag === 'EM' || (tag === 'SPAN' && element.style.fontStyle === 'italic')) {
    const em = doc.createElement('em')
    appendClean(em, element, doc)
    return [em]
  }

  if (
    tag === 'S' ||
    tag === 'STRIKE' ||
    tag === 'DEL' ||
    (tag === 'SPAN' && `${element.style.textDecorationLine} ${element.style.textDecoration}`.includes('line-through'))
  ) {
    const strike = doc.createElement('s')
    appendClean(strike, element, doc)
    return [strike]
  }

  if (tag === 'IMG') {
    const id = element.dataset.imageId ?? ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) return []
    const img = doc.createElement('img')
    img.dataset.imageId = id
    img.alt = element.getAttribute('alt') ?? ''
    const align = imageAlign(element.dataset.align ?? null)
    if (align) img.dataset.align = align
    const width = imageWidth(element.dataset.width ?? null)
    if (width) {
      img.dataset.width = String(width)
      img.style.width = `${width}%`
    }
    return [img]
  }

  if (tag === 'A') {
    const href = allowedHref(element.getAttribute('href') ?? '')
    if (!href) return [...element.childNodes].flatMap((child) => clean(child, doc))
    const link = doc.createElement('a')
    link.href = href
    appendClean(link, element, doc)
    return [link]
  }

  if (tag === 'BLOCKQUOTE' || tag === 'UL' || tag === 'OL' || tag === 'LI' || tag === 'P' || tag === 'DIV') {
    const next = doc.createElement(tag === 'DIV' ? 'p' : tag.toLowerCase())
    const align = textAlign(element)
    if (align && BLOCKS.has(next.tagName)) next.style.textAlign = align
    const indent = indentLevel(element)
    if (indent) next.dataset.indent = indent
    appendClean(next, element, doc)
    return [next]
  }

  return [...element.childNodes].flatMap((child) => clean(child, doc))
}

export function sanitize(html: string): string {
  const source = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const wrapper = source.body.firstElementChild
  if (!wrapper) return ''
  const doc = document.implementation.createHTMLDocument('')
  const root = doc.createElement('div')
  ;[...wrapper.childNodes].flatMap((child) => clean(child, doc)).forEach((child) => root.appendChild(child))
  return root.innerHTML
}

export function hydrateImages(html: string, urls: Record<string, string | false>): string {
  const safe = sanitize(html)
  const doc = new DOMParser().parseFromString(safe, 'text/html')
  doc.body.querySelectorAll('img[data-image-id]').forEach((node) => {
    const img = node as HTMLImageElement
    const id = img.dataset.imageId ?? ''
    const url = urls[id]
    if (typeof url === 'string') img.src = url
    if (url === false) {
      const missing = doc.createElement('p')
      missing.className = 'image-missing'
      missing.textContent = 'Image missing from this browser.'
      img.replaceWith(missing)
    }
  })
  return doc.body.innerHTML
}
