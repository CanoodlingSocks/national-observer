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
  root.focus()
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
  const [altError, setAltError] = useState('')
  const [imageError, setImageError] = useState('')

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
      const id = image.dataset.imageId ?? ''
      const url = urls[id]
      if (typeof url === 'string' && image.src !== url) image.src = url
    })
  }, [urls, resetKey])

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
    const html = editorRef.current?.innerHTML ?? ''
    onChange(html)
    void retainImages(imageIdsFromHtml(html))
    syncMarks()
  }

  function run(command: string, value?: string) {
    if (editorRef.current) placeCaret(editorRef.current, rangeRef.current)
    document.execCommand(command, false, value)
    emit()
  }

  function changeIndent(direction: 1 | -1) {
    const editor = editorRef.current
    if (!editor) return
    placeCaret(editor, rangeRef.current)
    let block = currentBlock(editor)
    if (!block) {
      document.execCommand('formatBlock', false, 'p')
      block = currentBlock(editor)
    }
    if (!block) return
    const level = Math.max(0, Math.min(3, Number(block.dataset.indent || 0) + direction))
    if (level === 0) delete block.dataset.indent
    else block.dataset.indent = String(level)
    emit()
  }

  function toggleQuote() {
    const editor = editorRef.current
    if (!editor) return
    placeCaret(editor, rangeRef.current)
    const inQuote = Boolean(currentBlock(editor)?.closest('blockquote'))
    document.execCommand('formatBlock', false, inQuote ? 'p' : 'blockquote')
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
    insertMarkup(editor, rangeRef.current, `<p><img data-image-id="${id}" alt="${escapeAttr(description)}"></p>`)
    setPendingFile(null)
    setAlt('')
    setAltError('')
    setImageError('')
    emit()
  }

  return (
    <div className="rich-text">
      <fieldset className="toolbar">
        <legend id={labelId}>Formatting</legend>
        <div className="toolbar-row">
          <MarkButton label="Bold" pressed={marks.bold} onPress={() => run('bold')} />
          <MarkButton label="Italic" pressed={marks.italic} onPress={() => run('italic')} />
          <MarkButton label="Strike" pressed={marks.strike} onPress={() => run('strikeThrough')} />
          <MarkButton label="Quote" pressed={marks.quote} onPress={toggleQuote} />
          <MarkButton label="Indent" onPress={() => changeIndent(1)} />
          <MarkButton label="Outdent" onPress={() => changeIndent(-1)} />
          <MarkButton label="Left" name="Align left" pressed={marks.left} onPress={() => run('justifyLeft')} />
          <MarkButton label="Center" name="Align center" pressed={marks.center} onPress={() => run('justifyCenter')} />
          <MarkButton label="Right" name="Align right" pressed={marks.right} onPress={() => run('justifyRight')} />
          <button type="button" className="btn" aria-label="Insert image" onMouseDown={(event) => event.preventDefault()} onClick={() => fileRef.current?.click()}>
            Image
          </button>
        </div>
      </fieldset>
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
          setAltError('')
          setImageError('')
          setPendingFile(file)
        }}
      />
      {imageError && !pendingFile ? <p role="alert" className="field-error">{imageError}</p> : null}
      <p id={bodyId} className="field-label">
        Article body
      </p>
      <div
        ref={editorRef}
        className="prose editor-surface"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={bodyId}
        onInput={emit}
        onKeyUp={() => {
          rangeRef.current = rememberRange(editorRef.current)
          syncMarks()
        }}
        onMouseUp={() => {
          rangeRef.current = rememberRange(editorRef.current)
          syncMarks()
        }}
        onBlur={() => {
          rangeRef.current = rememberRange(editorRef.current)
        }}
        onPaste={(event) => {
          event.preventDefault()
          const html = event.clipboardData.getData('text/html')
          const text = event.clipboardData.getData('text/plain')
          document.execCommand('insertHTML', false, html ? sanitize(html) : plainTextToHtml(text))
          emit()
        }}
      />
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
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {label}
    </button>
  )
}
