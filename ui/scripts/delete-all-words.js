/**
 * 표준 단어(meta_std_word_m) 전체 삭제
 * node scripts/delete-all-words.js --yes
 */
import readline from 'readline'
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg
const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'postgres',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
})

const force = process.argv.includes('--yes') || process.argv.includes('-y')

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

async function main() {
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM meta_std_word_m')
  const { rows: [{ count: termCount }] } = await pool.query('SELECT COUNT(*)::int AS count FROM meta_std_term_m')

  if (count === 0) {
    console.log('삭제할 표준 단어가 없습니다.')
    await pool.end()
    return
  }

  console.log(`표준 단어: ${count}건`)
  console.log(`표준 용어: ${termCount}건 (삭제되지 않음)`)
  console.log('표준 단어만 삭제됩니다. 표준 용어는 그대로 남습니다.')

  if (!force) {
    if (!process.stdin.isTTY) {
      console.error('비대화형 환경에서는 --yes 옵션을 사용하세요.')
      process.exit(1)
    }
    const answer = await ask(`\n표준 단어 ${count}건을 모두 삭제하시겠습니까? (yes/no): `)
    if (answer !== 'yes' && answer !== 'y') {
      console.log('취소되었습니다.')
      await pool.end()
      return
    }
  }

  await pool.query('TRUNCATE TABLE meta_std_word_m RESTART IDENTITY CASCADE')
  console.log(`\n표준 단어 ${count}건 삭제 완료.`)
  await pool.end()
}

main().catch((err) => {
  console.error('오류:', err.message)
  process.exit(1)
})
