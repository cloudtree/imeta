const OLLAMA_URL = process.env.OLLAMA_URL?.trim() || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || 'qwen2.5:7b'
const OLLAMA_TIMEOUT_MS = 60_000

/**
 * 로컬 sLLM(Ollama)로 튜닝 리포트 해설 생성 — 폐쇄망 내 동작.
 * Ollama가 없거나 실패하면 null 반환(우아한 생략).
 */
export async function generateExplanation({ sqlText, planText, findings, dbType = 'Oracle' }) {
  const topFindings = findings.slice(0, 8).map(
    (f) => `- [${f.severity}] ${f.title}: ${f.description}`,
  ).join('\n')

  const prompt = [
    `당신은 ${dbType} SQL 튜닝 전문가입니다. 아래 SQL과 실행계획, 자동 분석 결과를 바탕으로`,
    '문제 요약과 우선 개선 순서를 한국어로 간결하게(500자 이내) 설명하세요.',
    '',
    '## SQL',
    sqlText,
    '',
    '## 실행계획',
    planText?.slice(0, 3000) ?? '(없음)',
    '',
    '## 자동 분석 결과',
    topFindings || '(발견된 문제 없음)',
  ].join('\n')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const text = data.response?.trim()
    return text ? { model: OLLAMA_MODEL, text } : null
  } catch {
    return null
  }
}
