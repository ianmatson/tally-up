import type { Context } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { User } from '../shared/api'
import { type AppEnv, clearSessionCookie, currentUser, UPLOADED_AVATAR_PREFIX } from './auth'
import { parseProfile } from './validate'

const AVATAR_TYPE = 'image/jpeg'
const AVATAR_MAX_BYTES = 150_000
const IMMUTABLE = 'public, max-age=31536000, immutable'

async function changeAvatar(c: Context<AppEnv>, imageChange: D1PreparedStatement, avatarUrl: string | null): Promise<User> {
  const user = currentUser(c)
  await c.env.DB.batch([imageChange, c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(avatarUrl, user.id)])
  return { ...user, avatarUrl }
}

export const profile = new Hono<AppEnv>()

profile.delete('/', async (c) => {
  const userId = currentUser(c).id
  const { userId: confirmedId } = await c.req.json<{ userId?: string }>().catch(() => ({ userId: undefined }))
  if (confirmedId !== userId) throw new HTTPException(409, { message: 'You are signed in to a different account here. Reload the page and try again.' })
  const nextOwner = `(SELECT m.user_id FROM memberships m WHERE m.group_id = groups.id AND m.user_id != ?1 ORDER BY m.joined_at LIMIT 1)`
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE groups SET owner_id = ${nextOwner} WHERE owner_id = ?1 AND ${nextOwner} IS NOT NULL`).bind(userId),
    c.env.DB.prepare('DELETE FROM groups WHERE owner_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])
  clearSessionCookie(c)
  return c.body(null, 204)
})

profile.patch('/', async (c) => {
  const name = parseProfile(await c.req.json())
  const user = currentUser(c)
  await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, user.id).run()
  return c.json({ user: { ...user, name } })
})

profile.put('/avatar', bodyLimit({ maxSize: AVATAR_MAX_BYTES, onError: (c) => c.json({ error: 'That image is too large' }, 413) }), async (c) => {
  if (c.req.header('content-type') !== AVATAR_TYPE) throw new HTTPException(415, { message: 'Upload a JPEG image' })
  const image = await c.req.arrayBuffer()
  if (image.byteLength === 0) throw new HTTPException(400, { message: 'Choose an image' })
  const userId = currentUser(c).id
  const store = c.env.DB.prepare('INSERT INTO avatars (user_id, image) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET image = excluded.image').bind(userId, image)
  return c.json({ user: await changeAvatar(c, store, `${UPLOADED_AVATAR_PREFIX}${userId}?v=${Date.now()}`) })
})

profile.delete('/avatar', async (c) => {
  return c.json({ user: await changeAvatar(c, c.env.DB.prepare('DELETE FROM avatars WHERE user_id = ?').bind(currentUser(c).id), null) })
})

export async function avatarImage(c: Context<AppEnv>) {
  const row = await c.env.DB.prepare('SELECT image FROM avatars WHERE user_id = ?').bind(c.req.param('userId')).first<{ image: number[] }>()
  if (!row) return c.notFound()
  return c.body(new Uint8Array(row.image), 200, { 'content-type': AVATAR_TYPE, 'cache-control': IMMUTABLE })
}
