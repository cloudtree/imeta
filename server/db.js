import pg from 'pg'
import { getPoolOptions } from './dbConfig.js'

const { Pool } = pg

export const pool = new Pool(getPoolOptions())

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})
