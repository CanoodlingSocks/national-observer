import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Masthead } from './components/Masthead'
import { usePaper } from './paper-context'

export function Shell() {
  return <Frame />
}

function Frame() {
  const { ready, loadError } = usePaper()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mainRef.current?.focus()
  }, [pathname])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Masthead />
      <main id="main" tabIndex={-1} ref={mainRef}>
        {loadError ? (
          <p className="sheet" role="alert">
            {loadError}
          </p>
        ) : ready ? (
          <Outlet />
        ) : (
          <p className="sheet" role="status">
            Opening the paper…
          </p>
        )}
      </main>
      <footer className="colophon">
        <p className="sheet">
          The National Observer. Established 1969. Independent journalism. The voices of reason since 1969. Set in
          Newsreader and Source Serif.
          {import.meta.env.DEV
            ? ' Clearing this browser’s data erases the paper unless a backup has been exported.'
            : ''}
        </p>
      </footer>
    </>
  )
}

export function NotFound() {
  return (
    <div className="sheet reading">
      <h1>This page is not on the paper.</h1>
    </div>
  )
}
