import type { Context } from 'hono'
import type { AppEnv } from './auth'

const INVITE_IMAGE = '/og-invite.png'

type InviteGroup = { name: string; member_count: number }

export async function invitePage(c: Context<AppEnv>) {
  const url = new URL(c.req.url)
  const shell = await c.env.ASSETS.fetch(new URL('/', url))
  const group = await c.env.DB.prepare(
    `SELECT g.name, (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) AS member_count
     FROM groups g WHERE g.invite_code = ?`,
  )
    .bind(c.req.param('code'))
    .first<InviteGroup>()
  if (!group) return shell

  const title = `Join ${group.name} on Tally Up`
  const description = `${group.member_count} ${group.member_count === 1 ? 'friend is' : 'friends are'} working toward a shared workout goal. Join them, log your reps and miles, and see if the crew is on pace.`
  const image = new URL(INVITE_IMAGE, url).href
  const setContent = (value: string) => ({
    element: (el: Element) => {
      el.setAttribute('content', value)
    },
  })

  return new HTMLRewriter()
    .on('title', {
      element: (el) => {
        el.setInnerContent(title)
      },
    })
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:title"], meta[name="twitter:title"]', setContent(title))
    .on('meta[property="og:description"], meta[name="twitter:description"]', setContent(description))
    .on('meta[property="og:image"], meta[name="twitter:image"]', setContent(image))
    .on('meta[property="og:image:alt"]', setContent(`You're invited to ${group.name} on Tally Up`))
    .on('meta[property="og:url"]', setContent(url.href))
    .on('link[rel="canonical"]', {
      element: (el) => {
        el.setAttribute('href', url.href)
      },
    })
    .transform(shell)
}
