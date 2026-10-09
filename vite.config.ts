/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/national-observer/' : '/',
  resolve: {
    alias: {
      '@entry': path.join(root, mode === 'production' ? 'src/main-public.tsx' : 'src/main-dev.tsx'),
    },
  },
  plugins: [
    react(),
    {
      name: 'github-pages-fallback',
      apply: 'build',
      writeBundle(options) {
        if (!options.dir) return
        fs.copyFileSync(path.join(options.dir, 'index.html'), path.join(options.dir, '404.html'))
      },
    },
  ],
  test: {
    environment: 'jsdom',
  },
}))
