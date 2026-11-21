import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { api } from './api'
import { type AppEnv, auth, loadUser } from './auth'
import { invitePage } from './invite-page'
import { sendReminders } from './notifications'

const app = new Hono<AppEnv>()

app.use(csrf())
app.use(loadUser)
app.route('/auth', auth)
app.route('/api', api)
app.get('/join/:code', invitePage)

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

export default {
  fetch: app.fetch,
  scheduled: (_controller, env, ctx) => ctx.waitUntil(sendReminders(env)),
} satisfies ExportedHandler<Env>
