import { useEffect, useId, useRef, useState } from 'react'
import { QUOTA_MESSAGE, isQuotaError } from '../db'
import { imageIdsFromHtml } from '../model'
import { usePaper } from '../paper'
import { plainTextToHtml, sanitize } from '../sanitize'
import { Dialog } from './Dialog'

type Marks = {
  bold: boolean
  italic: boolean
  strike: boolean
  quote: boolean
  left: boolean
  center: boolean
  right: boolean
}

type Align = 'left' | 'right' | 'center'

type ImageEdit = {
  id: string
  align: Align
  width: number
  alt: string
}

const EMPTY_MARKS: Marks = {
  bold: false,
  italic: false,
  strike: false,
  quote: false,
  left: false,
  center: false,
  right: false,
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function rememberRange(root: HTMLElement | null): Range | null {
  const selection = window.getSelection()
  if (!root || !selection || selection.rangeCount === 0) return null
  if (!selection.anchorNode || !root.contains(selection.anchorNode)) return null
  return selection.getRangeAt(0).cloneRange()
}

function insertMarkup(root: HTMLElement, range: Range | null, markup: string) {
  const template = document.createElement('template')
  template.innerHTML = markup
  if (range && root.contains(range.startContainer)) {
    range.collapse(false)
    range.insertNode(template.content)
    return
  }
  root.append(template.content)
}

function placeCaret(root: HTMLElement, range: Range | null) {
  const selection = window.getSelection()
  root.focus({ preventScroll: true })
  if (!selection) return
  if (range && root.contains(range.startContainer)) {
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }
  const fallback = document.createRange()
  fallback.selectNodeContents(root)
  fallback.collapse(false)
  selection.removeAllRanges()
  selection.addRange(fallback)
}

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return 40
  return Math.max(20, Math.min(100, Math.round(value)))
}

function readAlign(image: HTMLImageElement): Align {
  const align = image.dataset.align
  if (align === 'left' || align === 'right' || align === 'center') return align
  return 'center'
}

function readWidth(image: HTMLImageElement): number {
  const width = Number(image.dataset.width)
  if (Number.isInteger(width) && width >= 20 && width <= 100) return width
  return 100
}

function currentBlock(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  const node = selection?.anchorNode
  if (!node || !root.contains(node)) return null
  const element = node instanceof HTMLElement ? node : node.parentElement
  const block = element?.closest('p, blockquote, li')
  if (!block || block === root || !root.contains(block)) return null
  return block as HTMLElement
}

export function RichText({
  resetKey,
  initialHtml,
  onChange,
}: {
  resetKey: string
  initialHtml: string
  onChange: (html: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const initialRef = useRef(initialHtml)
  const labelId = useId()
  const bodyId = useId()
  const altId = useId()
  const altErrorId = useId()
  const { urls, retainImages, saveImage } = usePaper()
  const [marks, setMarks] = useState<Marks>(EMPTY_MARKS)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [pendingAlign, setPendingAlign] = useState<Align>('left')
  const [pendingWidth, setPendingWidth] = useState(40)
  const [altError, setAltError] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageEdit, setImageEdit] = useState<ImageEdit | null>(null)
  const alignName = useId()
  const widthId = useId()
  const pendingWidthId = useId()
  const editAltId = useId()

  initialRef.current = initialHtml

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = initialRef.current
    void retainImages(imageIdsFromHtml(initialRef.current))
  }, [resetKey, retainImages])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.querySelectorAll('img[data-image-id]').forEach((node) => {
      const image = node as HTMLImageElement
      image.setAttribute('contenteditable', 'false')
      const id = image.dataset.imageId ?? ''
      const url = urls[id]
      if (typeof url === 'string' && image.src !== url) image.src = url
    })
  }, [urls, resetKey])

  useEffect(() => {
    const onSelection = () => {
      const next = rememberRange(editorRef.current)
      if (next) rangeRef.current = next
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  function syncMarks() {
    const editor = editorRef.current
    const quote = Boolean(editor && currentBlock(editor)?.closest('blockquote'))
    const state = (command: string) => {
      try {
        return document.queryCommandState(command)
      } catch {
        return false
      }
    }
    setMarks({
      bold: state('bold'),
      italic: state('italic'),
      strike: state('strikeThrough'),
      quote,
      left: state('justifyLeft'),
      center: state('justifyCenter'),
      right: state('justifyRight'),
    })
  }

  function emit() {
    const editor = editorRef.current
    if (!editor) return
    const copy = editor.cloneNode(true) as HTMLElement
    copy.querySelectorAll('[data-selected]').forEach((node) => node.removeAttribute('data-selected'))
    const html = copy.innerHTML
    onChange(html)
    void retainImages(imageIdsFromHtml(html))
    syncMarks()
    if (imageEdit && !editor.querySelector(`img[data-image-id="${CSS.escape(imageEdit.id)}"]`)) setImageEdit(null)
  }

  function keepPlace(action: () => void) {
    const editor = editorRef.current
    if (!editor) return
    const pageX = window.scrollX
    const pageY = window.scrollY
    const editorY = editor.scrollTop
    const column = editor.parentElement
    const columnY = column?.scrollTop ?? 0
    placeCaret(editor, rangeRef.current)
    action()
    emit()
    const restore = () => {
      window.scrollTo(pageX, pageY)
      editor.scrollTop = editorY
      if (column) column.scrollTop = columnY
    }
    restore()
    requestAnimationFrame(restore)
  }

  function run(command: string, value?: string) {
    keepPlace(() => {
      document.execCommand(command, false, value)
    })
  }

  function changeIndent(direction: 1 | -1) {
    keepPlace(() => {
      const editor = editorRef.current
      if (!editor) return
      let block = currentBlock(editor)
      if (!block) {
        document.execCommand('formatBlock', false, 'p')
        block = currentBlock(editor)
      }
      if (!block) return
      const level = Math.max(0, Math.min(3, Number(block.dataset.indent || 0) + direction))
      if (level === 0) delete block.dataset.indent
      else block.dataset.indent = String(level)
    })
  }

  function toggleQuote() {
    keepPlace(() => {
      const editor = editorRef.current
      if (!editor) return
      const inQuote = Boolean(currentBlock(editor)?.closest('blockquote'))
      document.execCommand('formatBlock', false, inQuote ? 'p' : 'blockquote')
    })
  }

  function chooseImage(image: HTMLImageElement) {
    const editor = editorRef.current
    editor?.querySelectorAll('img[data-selected]').forEach((node) => node.removeAttribute('data-selected'))
    image.dataset.selected = 'true'
    setImageEdit({
      id: image.dataset.imageId ?? '',
      align: readAlign(image),
      width: readWidth(image),
      alt: image.alt,
    })
  }

  function applyImage(next: ImageEdit) {
    const editor = editorRef.current
    const image = editor?.querySelector(`img[data-image-id="${CSS.escape(next.id)}"]`)
    if (!(image instanceof HTMLImageElement)) return
    image.dataset.align = next.align
    image.dataset.width = String(next.width)
    image.style.width = `${next.width}%`
    image.alt = next.alt
    image.dataset.selected = 'true'
    setImageEdit(next)
    emit()
  }

  async function insertPending() {
    const file = pendingFile
    const editor = editorRef.current
    const description = alt.trim()
    if (!file || !editor) return
    if (!description) {
      setAltError('Describe the image before inserting it.')
      document.getElementById(altId)?.focus()
      return
    }
    const id = crypto.randomUUID()
    try {
      await saveImage({ id, alt: description, blob: file })
    } catch (error) {
      setImageError(isQuotaError(error) ? QUOTA_MESSAGE : 'The image could not be saved in this browser.')
      return
    }
    const width = clampWidth(pendingWidth)
    insertMarkup(
      editor,
      rangeRef.current,
      `<img data-image-id="${id}" alt="${escapeAttr(description)}" data-align="${pendingAlign}" data-width="${width}" style="width: ${width}%" contenteditable="false">`,
    )
    const inserted = editor.querySelector(`img[data-image-id="${CSS.escape(id)}"]`)
    if (inserted instanceof HTMLImageElement) chooseImage(inserted)
    setPendingFile(null)
    setAlt('')
    setPendingAlign('left')
    setPendingWidth(40)
    setAltError('')
    setImageError('')
    emit()
  }

  return (
    <div className="rich-text">
      <p id={bodyId} className="field-label">
        Article body
      </p>
      <div className="editor-layout">
        <fieldset className="toolbar editor-toolbar">
          <legend id={labelId}>Formatting</legend>
          <div className="toolbar-row" role="toolbar" aria-labelledby={labelId}>
            <MarkButton label="Bold" pressed={marks.bold} onPress={() => run('bold')} />
            <MarkButton label="Italic" pressed={marks.italic} onPress={() => run('italic')} />
            <MarkButton label="Strike" pressed={marks.strike} onPress={() => run('strikeThrough')} />
            <MarkButton label="Quote" pressed={marks.quote} onPress={toggleQuote} />
            <MarkButton label="Indent" onPress={() => changeIndent(1)} />
            <MarkButton label="Outdent" onPress={() => changeIndent(-1)} />
            <MarkButton label="Left" name="Align left" pressed={marks.left} onPress={() => run('justifyLeft')} />
            <MarkButton label="Center" name="Align center" pressed={marks.center} onPress={() => run('justifyCenter')} />
            <MarkButton label="Right" name="Align right" pressed={marks.right} onPress={() => run('justifyRight')} />
            <button
              type="button"
              className="btn"
              aria-label="Insert image"
              title="Insert image"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              Image
            </button>
          </div>
          {imageEdit ? (
            <div className="image-settings" role="group" aria-label="Selected illustration">
              <p className="field-label">Selected illustration</p>
              <div className="toolbar-row" role="group" aria-label="Image placement">
                <MarkButton label="Left" name="Place image on the left" pressed={imageEdit.align === 'left'} onPress={() => applyImage({ ...imageEdit, align: 'left' })} />
                <MarkButton label="Right" name="Place image on the right" pressed={imageEdit.align === 'right'} onPress={() => applyImage({ ...imageEdit, align: 'right' })} />
                <MarkButton label="Center" name="Center image" pressed={imageEdit.align === 'center'} onPress={() => applyImage({ ...imageEdit, align: 'center' })} />
              </div>
              <div className="field">
                <label htmlFor={widthId}>Width</label>
                <div className="width-row">
                  <input
                    id={widthId}
                    type="number"
                    min={20}
                    max={100}
                    inputMode="numeric"
                    value={imageEdit.width}
                    aria-describedby={`${widthId}-note`}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      if (value >= 20 && value <= 100) applyImage({ ...imageEdit, width: Math.round(value) })
                      else setImageEdit({ ...imageEdit, width: value })
                    }}
                    onBlur={() => applyImage({ ...imageEdit, width: clampWidth(imageEdit.width) })}
                  />
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={imageEdit.width}
                    aria-label="Image width"
                    aria-valuetext={`${imageEdit.width} percent`}
                    onChange={(event) => applyImage({ ...imageEdit, width: clampWidth(Number(event.target.value)) })}
                  />
                </div>
                <p id={`${widthId}-note`} className="hint">
                  Percent of the column. The height follows the picture.
                </p>
              </div>
              <div className="field">
                <label htmlFor={editAltId}>Description</label>
                <input id={editAltId} value={imageEdit.alt} onChange={(event) => applyImage({ ...imageEdit, alt: event.target.value })} />
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const editor = editorRef.current
                  editor?.querySelector(`img[data-image-id="${CSS.escape(imageEdit.id)}"]`)?.remove()
                  setImageEdit(null)
                  emit()
                }}
              >
                Remove image
              </button>
            </div>
          ) : null}
        </fieldset>
        <div className="editor-column">
          <div
            ref={editorRef}
            className="prose editor-surface"
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-labelledby={bodyId}
            onInput={emit}
            onClick={(event) => {
              const editor = editorRef.current
              const target = event.target
              if (target instanceof HTMLImageElement && target.dataset.imageId) {
                chooseImage(target)
                return
              }
              editor?.querySelectorAll('[data-selected]').forEach((node) => node.removeAttribute('data-selected'))
              setImageEdit(null)
            }}
            onKeyUp={() => {
              rangeRef.current = rememberRange(editorRef.current)
              syncMarks()
            }}
            onMouseUp={() => {
              rangeRef.current = rememberRange(editorRef.current)
              syncMarks()
            }}
            onBlur={() => {
              const next = rememberRange(editorRef.current)
              if (next) rangeRef.current = next
            }}
            onPaste={(event) => {
              event.preventDefault()
              const html = event.clipboardData.getData('text/html')
              const text = event.clipboardData.getData('text/plain')
              document.execCommand('insertHTML', false, html ? sanitize(html) : plainTextToHtml(text))
              emit()
            }}
          />
        </div>
      </div>
      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          rangeRef.current = rememberRange(editorRef.current)
          setAlt('')
          setPendingAlign('left')
          setPendingWidth(40)
          setAltError('')
          setImageError('')
          setPendingFile(file)
        }}
      />
      {imageError && !pendingFile ? <p role="alert" className="field-error">{imageError}</p> : null}
      {pendingFile ? (
        <Dialog
          title="Describe this image"
          onClose={() => {
            setPendingFile(null)
            setAltError('')
          }}
        >
          <div className="field">
            <label htmlFor={altId}>Image description</label>
            <input
              id={altId}
              value={alt}
              aria-invalid={altError ? true : undefined}
              aria-describedby={altError ? altErrorId : undefined}
              onChange={(event) => {
                setAlt(event.target.value)
                setAltError('')
              }}
            />
            {altError ? (
              <p id={altErrorId} className="field-error">
                {altError}
              </p>
            ) : null}
          </div>
          <div className="field">
            <p id={alignName} className="field-label">
              Placement
            </p>
            <div className="toolbar-row" role="group" aria-labelledby={alignName}>
              <MarkButton label="Left" name="Place image on the left" pressed={pendingAlign === 'left'} onPress={() => setPendingAlign('left')} />
              <MarkButton label="Right" name="Place image on the right" pressed={pendingAlign === 'right'} onPress={() => setPendingAlign('right')} />
              <MarkButton label="Center" name="Center image" pressed={pendingAlign === 'center'} onPress={() => setPendingAlign('center')} />
            </div>
          </div>
          <div className="field">
            <label htmlFor={pendingWidthId}>Width</label>
            <div className="width-row">
              <input
                id={pendingWidthId}
                type="number"
                min={20}
                max={100}
                inputMode="numeric"
                value={pendingWidth}
                aria-describedby={`${pendingWidthId}-note`}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isFinite(value)) setPendingWidth(value)
                }}
                onBlur={() => setPendingWidth((current) => clampWidth(current))}
              />
              <input
                type="range"
                min={20}
                max={100}
                value={pendingWidth}
                aria-label="Image width"
                aria-valuetext={`${pendingWidth} percent`}
                onChange={(event) => setPendingWidth(clampWidth(Number(event.target.value)))}
              />
            </div>
            <p id={`${pendingWidthId}-note`} className="hint">
              Percent of the column. Text wraps around a left or right picture.
            </p>
          </div>
          {imageError ? <p role="alert">{imageError}</p> : null}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => setPendingFile(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void insertPending()}>
              Insert image
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}

function MarkButton({
  label,
  name,
  pressed,
  onPress,
}: {
  label: string
  name?: string
  pressed?: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      className="btn"
      aria-label={name}
      title={name ?? label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {label}
    </button>
  )
}
