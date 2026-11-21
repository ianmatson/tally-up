import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { api } from './api'
import { type AppEnv, auth, loadUser } from './auth'

const app = new Hono<AppEnv>()

app.use(csrf())
app.use(loadUser)
app.route('/auth', auth)
app.route('/api', api)

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

export default app
