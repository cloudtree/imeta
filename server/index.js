import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import wordsRouter   from './routes/words.js'
import termsRouter   from './routes/terms.js'
import domainsRouter from './routes/domains.js'

const app  = express()
const PORT = process.env.PORT ?? 3000

app.use(cors())
app.use(express.json())

app.use('/api/words',   wordsRouter)
app.use('/api/terms',   termsRouter)
app.use('/api/domains', domainsRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
