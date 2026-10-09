import { Link, useLocation } from 'react-router-dom'

function DeskLink({ pathname }: { pathname: string }) {
  const onDesk = pathname.startsWith('/desk')
  return (
    <li>
      <Link to="/desk" aria-current={onDesk ? 'page' : undefined}>
        The desk
      </Link>
    </li>
  )
}

export function Masthead() {
  const { pathname } = useLocation()
  const home = pathname === '/'
  const onPaper = home || pathname.startsWith('/article/')
  const NameTag = home ? 'h1' : 'p'

  return (
    <header className="nav-mast">
      <div className="sheet mast-identity">
        <p className="mast-line">ESTABLISHED 1969 · INDEPENDENT JOURNALISM</p>
        <NameTag className="mast-name">The National Observer</NameTag>
        <p className="mast-slogan">The voices of reason since 1969</p>
      </div>
      <nav className="mast-nav" aria-label="Sections">
        <div className="sheet">
          <ul className="mast-links">
            <li>
              <Link to="/" aria-current={onPaper ? 'page' : undefined}>
                The paper
              </Link>
            </li>
            {import.meta.env.DEV ? <DeskLink pathname={pathname} /> : null}
          </ul>
        </div>
        <div className="mast-rule" aria-hidden="true" />
      </nav>
    </header>
  )
}
