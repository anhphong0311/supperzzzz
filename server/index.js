require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { initSchema } = require('./db')
const authRoutes = require('./routes/auth')
const staffRoutes = require('./routes/staff')
const sheetsRoutes = require('./routes/sheets')
const errorHandler = require('./middleware/errorHandler')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/sheets', sheetsRoutes)

app.use(errorHandler)

const PORT = process.env.PORT || 4000

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FB Multi Poster auth server dang chay tren cong ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Khong the khoi tao schema:', err)
    process.exit(1)
  })
