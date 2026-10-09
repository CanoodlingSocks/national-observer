import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { NotFound, Shell } from './App'
import { routerBasename } from './basename'
import { ArticleEditor } from './components/ArticleEditor'
import { ArticlePage } from './components/ArticlePage'
import { Authors } from './components/Authors'
import { Desk } from './components/Desk'
import { Magazine } from './components/Magazine'
import { PaperProvider } from './paper'

export function mount() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <Magazine /> },
          { path: 'article/:id', element: <ArticlePage /> },
          { path: 'desk', element: <Desk /> },
          { path: 'desk/authors', element: <Authors /> },
          { path: 'desk/article/:id', element: <ArticleEditor /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
    { basename: routerBasename() },
  )

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PaperProvider>
        <RouterProvider router={router} />
      </PaperProvider>
    </StrictMode>,
  )
}
