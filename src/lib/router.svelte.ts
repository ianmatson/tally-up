class Router {
  url = $state(new URL(window.location.href))
}

export const router = new Router()

export function navigate(to: string, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', to)
  router.url = new URL(window.location.href)
  const anchor = window.location.hash && document.getElementById(window.location.hash.slice(1))
  if (!anchor) return window.scrollTo(0, 0)
  anchor.scrollIntoView({ behavior: 'smooth' })
  anchor.focus({ preventScroll: true })
}

window.addEventListener('popstate', () => {
  router.url = new URL(window.location.href)
})

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = (event.target as Element | null)?.closest('a')
  if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.origin !== window.location.origin) return
  if (resolveRoute(anchor.pathname).name === 'not-found') return
  event.preventDefault()
  navigate(anchor.pathname + anchor.search + anchor.hash)
})

export const GROUP_TABS = [
  { id: 'dashboard', path: '', navLabel: 'Home', title: 'Home', inNav: true },
  { id: 'feed', path: 'feed', navLabel: 'Feed', title: 'Feed', inNav: true },
  { id: 'leaderboard', path: 'leaderboard', navLabel: 'Leaders', title: 'Leaderboard', inNav: true },
  { id: 'history', path: 'history', navLabel: 'History', title: 'History', inNav: true },
  { id: 'admin', path: 'admin', navLabel: 'Admin', title: 'Admin', inNav: false },
] as const

export type GroupTab = (typeof GROUP_TABS)[number]['id']

export const groupTabHref = (groupId: string, tab: (typeof GROUP_TABS)[number]) =>
  tab.path ? `/g/${groupId}/${tab.path}` : `/g/${groupId}`

export type Route =
  | { name: 'home' }
  | { name: 'groups' }
  | { name: 'settings' }
  | { name: 'join'; code: string }
  | { name: 'group'; groupId: string; tab: GroupTab }
  | { name: 'not-found' }

export function resolveRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { name: 'home' }
  if (segments[0] === 'groups' && segments.length === 1) return { name: 'groups' }
  if (segments[0] === 'settings' && segments.length === 1) return { name: 'settings' }
  if (segments[0] === 'join' && segments.length === 2) return { name: 'join', code: segments[1] }
  if (segments[0] === 'g' && (segments.length === 2 || segments.length === 3)) {
    const tab = GROUP_TABS.find((t) => t.path === (segments[2] ?? ''))
    if (tab) return { name: 'group', groupId: segments[1], tab: tab.id }
  }
  return { name: 'not-found' }
}
