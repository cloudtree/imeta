/**
 * Render 대시보드 설정 자동화
 *
 * 사용법:
 *   RENDER_API_KEY=rnd_xxx node scripts/render-setup.mjs
 *
 * Account Settings → API Keys 에서 키 발급:
 * https://dashboard.render.com/u/settings#api-keys
 */
import 'dotenv/config'

const API = 'https://api.render.com/v1'
const REPO = 'https://github.com/cloudtree/imeta'
const BRANCH = 'main'
const API_SERVICE_NAMES = ['imeta', 'imeta-api']
const UI_SERVICE_NAME = 'imeta-ui'
const DEFAULT_API_URL = 'https://imeta.onrender.com'

const key = process.env.RENDER_API_KEY?.trim()
if (!key) {
  console.error('RENDER_API_KEY 환경 변수가 필요합니다.')
  console.error('Render Dashboard → Account Settings → API Keys')
  process.exit(1)
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${key}`,
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers, ...options })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function listServices() {
  const items = []
  let cursor
  do {
    const qs = new URLSearchParams({ limit: '100' })
    if (cursor) qs.set('cursor', cursor)
    const page = await api(`/services?${qs}`)
    for (const row of page) {
      if (row?.service) items.push(row.service)
    }
    cursor = page.at(-1)?.cursor
  } while (cursor)
  return items
}

async function getOwners() {
  const page = await api('/owners?limit=100')
  return page.map((row) => row.owner).filter(Boolean)
}

function pickApiService(services) {
  return services.find((s) => API_SERVICE_NAMES.includes(s.name))
    ?? services.find((s) => s.type === 'web_service' && s.repo?.includes('cloudtree/imeta'))
}

function pickUiService(services) {
  return services.find((s) => s.name === UI_SERVICE_NAME)
    ?? services.find((s) => s.type === 'static_site' && s.repo?.includes('cloudtree/imeta'))
}

function serviceUrl(service) {
  const slug = service.slug ?? service.name
  return `https://${slug}.onrender.com`
}

async function setEnvVar(serviceId, envKey, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(envKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
  console.log(`  env ${envKey}=${value}`)
}

async function triggerDeploy(serviceId, label) {
  const result = await api(`/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  })
  console.log(`  deploy queued (${label}): ${result?.id ?? 'ok'}`)
}

async function createUiService(ownerId, apiUrl) {
  const payload = {
    type: 'static_site',
    name: UI_SERVICE_NAME,
    ownerId,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: 'yes',
    rootDir: 'ui',
    serviceDetails: {
      buildCommand: 'npm install && npm run build',
      publishPath: 'dist',
    },
    envVars: [
      { key: 'VITE_API_URL', value: apiUrl },
    ],
  }
  const result = await api('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.service
}

async function main() {
  console.log('Render 서비스 조회 중...')
  const [services, owners] = await Promise.all([listServices(), getOwners()])
  if (!owners.length) throw new Error('Render workspace를 찾을 수 없습니다.')

  const apiService = pickApiService(services)
  if (!apiService) {
    throw new Error(`API Web Service를 찾을 수 없습니다. (${API_SERVICE_NAMES.join(', ')})`)
  }

  const apiUrl = serviceUrl(apiService)
  console.log(`API: ${apiService.name} (${apiService.id}) → ${apiUrl}`)

  let uiService = pickUiService(services)
  if (!uiService) {
    console.log(`UI Static Site (${UI_SERVICE_NAME}) 생성 중...`)
    uiService = await createUiService(owners[0].id, apiUrl)
    console.log(`UI 생성됨: ${uiService.name} (${uiService.id}) → ${serviceUrl(uiService)}`)
  } else {
    console.log(`UI: ${uiService.name} (${uiService.id}) → ${serviceUrl(uiService)}`)
  }

  const uiUrl = serviceUrl(uiService)

  console.log('\nAPI 환경 변수 설정...')
  await setEnvVar(apiService.id, 'NODE_ENV', 'production')
  await setEnvVar(apiService.id, 'CORS_ORIGIN', uiUrl)

  if (process.env.GOOGLE_AI_API_KEY?.trim()) {
    await setEnvVar(apiService.id, 'GOOGLE_AI_API_KEY', process.env.GOOGLE_AI_API_KEY.trim())
    await setEnvVar(
      apiService.id,
      'GOOGLE_AI_MODEL',
      process.env.GOOGLE_AI_MODEL?.trim() || 'gemini-2.5-flash',
    )
  } else {
    console.log('  (GOOGLE_AI_API_KEY 없음 — .env에 있으면 자동 설정)')
  }

  console.log('\nUI 환경 변수 설정...')
  await setEnvVar(uiService.id, 'VITE_API_URL', apiUrl)

  console.log('\n재배포 트리거...')
  await triggerDeploy(apiService.id, 'api')
  await triggerDeploy(uiService.id, 'ui')

  console.log('\n완료')
  console.log(`  API: ${apiUrl}/api/health`)
  console.log(`  UI:  ${uiUrl}`)
  console.log(`  CORS_ORIGIN=${uiUrl}`)
  console.log(`  VITE_API_URL=${apiUrl}`)
}

main().catch((err) => {
  console.error('\n오류:', err.message)
  process.exit(1)
})
