import { useMemo } from 'react'
import { format } from 'sql-formatter'

const KEYWORD_RE =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|USING|GROUP|BY|HAVING|ORDER|ASC|DESC|UNION|ALL|MINUS|INTERSECT|WITH|AS|CASE|WHEN|THEN|ELSE|END|INSERT|INTO|VALUES|UPDATE|SET|DELETE|MERGE|USING|MATCHED|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CAST|COALESCE|NVL|NVL2|DECODE|TRUNC|ROUND|SUBSTR|TO_CHAR|TO_DATE|TO_NUMBER|UPPER|LOWER|DUAL|FETCH|FIRST|ROWS|ONLY|OFFSET|CONNECT|START|PRIOR|LEVEL|ROWNUM|OVER|PARTITION|DENSE_RANK|RANK|ROW_NUMBER|SYSDATE|SYSTIMESTAMP)\b/gi

const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g
const BIND_RE = /:[A-Za-z][A-Za-z0-9_]*/g
const STRING_RE = /'(?:[^']|'')*'/g
const COMMENT_LINE_RE = /--[^\n]*/g
const COMMENT_BLOCK_RE = /\/\*[\s\S]*?\*\//g

function formatSql(sql) {
  const text = String(sql ?? '').trim()
  if (!text) return ''
  try {
    return format(text, {
      language: 'plsql',
      tabWidth: 2,
      keywordCase: 'upper',
      dataTypeCase: 'upper',
      functionCase: 'upper',
      indentStyle: 'standard',
      logicalOperatorNewline: 'before',
      expressionWidth: 80,
      linesBetweenQueries: 1,
    })
  } catch {
    return text
  }
}

/**
 * 토큰을 겹치지 않게 잘라 하이라이트 노드 생성
 * 우선순위: comment > string > bind > number > keyword
 */
function highlightSql(sql) {
  const src = String(sql ?? '')
  if (!src) return [{ type: 'plain', text: '' }]

  const marks = []
  const push = (re, type) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src))) {
      marks.push({ start: m.index, end: m.index + m[0].length, type, text: m[0] })
    }
  }

  push(COMMENT_BLOCK_RE, 'comment')
  push(COMMENT_LINE_RE, 'comment')
  push(STRING_RE, 'string')
  push(BIND_RE, 'bind')
  push(NUMBER_RE, 'number')
  push(KEYWORD_RE, 'keyword')

  marks.sort((a, b) => a.start - b.start || b.end - a.end)

  const chosen = []
  let cursor = 0
  for (const mark of marks) {
    if (mark.start < cursor) continue
    if (mark.start > cursor) {
      chosen.push({ type: 'plain', text: src.slice(cursor, mark.start) })
    }
    chosen.push({ type: mark.type, text: mark.text })
    cursor = mark.end
  }
  if (cursor < src.length) chosen.push({ type: 'plain', text: src.slice(cursor) })
  return chosen
}

export function formatTuningSql(sql) {
  return formatSql(sql)
}

/** 포맷 + 예약어/리터럴 색상 하이라이트된 SQL 뷰 */
export default function SqlHighlight({ sql, className = '', variant = 'default' }) {
  const formatted = useMemo(() => formatSql(sql), [sql])
  const tokens = useMemo(() => highlightSql(formatted), [formatted])

  return (
    <pre className={`sql-hl ${variant === 'after' ? 'sql-hl--after' : ''} ${className}`.trim()}>
      <code>
        {tokens.map((t, i) =>
          t.type === 'plain' ? (
            <span key={i}>{t.text}</span>
          ) : (
            <span key={i} className={`sql-hl__${t.type}`}>{t.text}</span>
          ),
        )}
      </code>
    </pre>
  )
}
