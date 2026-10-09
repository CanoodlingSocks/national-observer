export function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL
  if (base === '/') return undefined
  return base.replace(/\/$/, '')
}
