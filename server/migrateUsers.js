import { pool } from './db.js'
import { hashPassword } from './userPassword.js'

/**
 * meta_users 테이블 생성 + 기본 관리자 시드 (idempotent)
 */
export async function migrateUsers() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_users (
        user_id       SERIAL PRIMARY KEY,
        username      VARCHAR(50)  NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        user_nm       VARCHAR(100) NOT NULL DEFAULT '',
        email         VARCHAR(200),
        dept_nm       VARCHAR(100),
        role_cd       VARCHAR(20)  NOT NULL DEFAULT 'USER',
        use_yn        CHAR(1)      NOT NULL DEFAULT 'Y',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT meta_users_username_uk UNIQUE (username),
        CONSTRAINT meta_users_use_yn_ck CHECK (use_yn IN ('Y', 'N')),
        CONSTRAINT meta_users_role_cd_ck CHECK (role_cd IN ('ADMIN', 'USER'))
      )
    `)

    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM meta_users')
    if (rows[0].cnt === 0) {
      const username = process.env.AUTH_USERNAME?.trim() || 'cloudtree'
      const password = process.env.AUTH_PASSWORD ?? 'americano'
      const password_hash = await hashPassword(password)
      await client.query(
        `INSERT INTO meta_users (username, password_hash, user_nm, role_cd, use_yn)
         VALUES ($1, $2, $3, 'ADMIN', 'Y')`,
        [username, password_hash, '시스템 관리자'],
      )
      console.log(`[migrateUsers] seeded admin user: ${username}`)
    }
  } finally {
    client.release()
  }
}

/** API 응답용 — 비밀번호 해시 제외 */
export function sanitizeUser(row) {
  if (!row) return null
  const { password_hash, ...rest } = row
  return rest
}
