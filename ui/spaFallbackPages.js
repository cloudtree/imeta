/**
 * Vite SPA: 빌드 산출물에 클라이언트 라우트용 index.html 복제
 * Render Static Site가 /* rewrite 없이 /login 등을 직접 요청해도 404가 나지 않도록 함
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SPA_ROUTES = [
  'login',
  'words',
  'terms',
  'domains',
  'users',
  'data-objects',
  'subject-areas',
  'servers/register',
  'database/review',
  'database/table-definition-review',
  'database/data-models',
]

export function spaFallbackPages() {
  return {
    name: 'spa-fallback-pages',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')
      const indexHtml = join(outDir, 'index.html')
      if (!existsSync(indexHtml)) return

      for (const route of SPA_ROUTES) {
        const target = join(outDir, route, 'index.html')
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(indexHtml, target)
      }
      console.log(`[spa-fallback-pages] wrote ${SPA_ROUTES.length} route index.html files`)
    },
  }
}
