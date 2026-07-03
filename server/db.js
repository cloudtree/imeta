import pg from 'pg'
import { getPoolOptions } from './dbConfig.js'

const { Pool } = pg

let poolInstance = null

function createPool() {
  const instance = new Pool(getPoolOptions())
  instance.on('error', (err) => {
    console.error('PostgreSQL pool error:', err)
  })
  return instance
}

function getPoolInstance() {
  if (!poolInstance) poolInstance = createPool()
  return poolInstance
}

/** routes에서 pool.query 등으로 사용 */
export const pool = new Proxy({}, {
  get(_target, prop) {
    const instance = getPoolInstance()
    const value = instance[prop]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
