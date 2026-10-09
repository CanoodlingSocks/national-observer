import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { NotFound, Shell } from './App'
import { routerBasename } from './basename'
import { ArticlePage } from './components/ArticlePage'
import { Magazine } from './components/Magazine'
import { PublicPaperProvider } from './public-paper'

export function mount() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <Magazine /> },
          { path: 'article/:id', element: <ArticlePage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
    { basename: routerBasename() },
  )

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PublicPaperProvider>
        <RouterProvider router={router} />
      </PublicPaperProvider>
    </StrictMode>,
  )
}
