import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { api } from './api'
import { type AppEnv, auth, loadUser } from './auth'
import { emailAuth, purgeExpiredCodes } from './email-auth'
import { invitePage } from './invite-page'
import { sendReminders } from './notifications'
import { avatarImage } from './profile'

const CANONICAL_ORIGIN = 'https://tally.ianm.app'
const LEGACY_HOST_SUFFIX = '.workers.dev'
const MAX_API_BODY_BYTES = 160_000
const SECURITY_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

const app = new Hono<AppEnv>()

app.use(async (c, next) => {
  const url = new URL(c.req.url)
  if (!url.hostname.endsWith(LEGACY_HOST_SUFFIX)) return next()
  return c.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301)
})
app.use(async (c, next) => {
  await next()
  c.res = new Response(c.res.body, c.res)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value)
})
app.use(csrf())
app.use('/api/*', bodyLimit({ maxSize: MAX_API_BODY_BYTES, onError: (c) => c.json({ error: 'That request is too large' }, 413) }))
app.use('/api/*', loadUser)
app.route('/auth', auth)
app.route('/api/auth/email', emailAuth)
app.route('/api', api)
app.get('/join/:code', invitePage)
app.get('/avatars/:userId', avatarImage)

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

export default {
  fetch: app.fetch,
  scheduled: (_controller, env, ctx) => ctx.waitUntil(Promise.all([sendReminders(env), purgeExpiredCodes(env)])),
} satisfies ExportedHandler<Env>
