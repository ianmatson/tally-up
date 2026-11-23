import type { Context, Next } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { LIMITS } from '../shared/limits'
import { type AppEnv, insertUser, sha256Hex, startSession, userIdByEmail } from './auth'
import { badRequest, parseEmailCode, parseEmailStart } from './validate'

const SENDER = { email: 'login@tally.ianm.app', name: 'Tally Up' }
const CODE_TTL_MS = 10 * 60_000
const RESEND_AFTER_MS = 30_000
const MAX_ATTEMPTS = 5

const codeHash = (email: string, code: string) => sha256Hex(`${email}:${code}`)

function newCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return String(value % 10 ** LIMITS.loginCode).padStart(LIMITS.loginCode, '0')
}

async function assertNotFlooding(c: Context<AppEnv>, next: Next) {
  const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })
  if (!success) throw new HTTPException(429, { message: 'Too many tries. Wait a minute and try again.' })
  await next()
}

function codeEmail(code: string) {
  return {
    subject: `${code} is your Tally Up code`,
    text: `Your Tally Up sign-in code is ${code}.\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#151515">
  <p style="margin:0 0 16px;font-size:15px">Your Tally Up sign-in code:</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
  <p style="margin:0;font-size:13px;color:#6b6b6b">It works for 10 minutes. If you did not ask for it, you can ignore this email.</p>
</div>`,
  }
}

const MAX_BODY_BYTES = 1024
const CODE_NO_LONGER_WORKS = 'This code no longer works. Send a new one.'

export function purgeExpiredCodes(env: Env) {
  return env.DB.prepare('DELETE FROM login_codes WHERE sent_at <= ?').bind(Date.now() - CODE_TTL_MS).run()
}

export const emailAuth = new Hono<AppEnv>()

emailAuth.use(assertNotFlooding, bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => badRequest('Request too large') }))

emailAuth.post('/start', async (c) => {
  const email = parseEmailStart(await c.req.json())
  const now = Date.now()
  const code = newCode()
  const hash = await codeHash(email, code)
  const stored = await c.env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, sent_at, attempts) VALUES (?1, ?2, ?3, 0)
     ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, sent_at = excluded.sent_at, attempts = 0
     WHERE login_codes.sent_at <= ?3 - ?4
     RETURNING email`,
  )
    .bind(email, hash, now, RESEND_AFTER_MS)
    .first()
  if (!stored) throw new HTTPException(429, { message: 'A code was just sent. Wait a few seconds before you ask for a new one.' })
  try {
    await c.env.EMAIL.send({ to: email, from: SENDER, ...codeEmail(code) })
  } catch (error) {
    console.error('Login code email failed', error)
    await c.env.DB.prepare('DELETE FROM login_codes WHERE email = ? AND code_hash = ?').bind(email, hash).run()
    throw new HTTPException(502, { message: 'Could not send the code. Check the address and try again.' })
  }
  return c.body(null, 204)
})

emailAuth.post('/verify', async (c) => {
  const { email, code } = parseEmailCode(await c.req.json())
  const attempt = await c.env.DB.prepare(
    'UPDATE login_codes SET attempts = attempts + 1 WHERE email = ? AND attempts < ? AND sent_at > ? RETURNING code_hash',
  )
    .bind(email, MAX_ATTEMPTS, Date.now() - CODE_TTL_MS)
    .first<{ code_hash: string }>()
  if (!attempt) badRequest(CODE_NO_LONGER_WORKS)
  const hash = await codeHash(email, code)
  if (attempt.code_hash !== hash) badRequest('That code is not right. Check the email and try again.')
  const used = await c.env.DB.prepare('DELETE FROM login_codes WHERE email = ? AND code_hash = ? RETURNING email').bind(email, hash).first()
  if (!used) badRequest(CODE_NO_LONGER_WORKS)
  await startSession(c, (await userIdByEmail(c.env.DB, email)) ?? (await insertUser(c.env.DB, { email })))
  return c.body(null, 204)
})
