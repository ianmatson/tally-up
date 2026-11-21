import type { PushSubscriptionInput } from '$shared/api'
import { api } from './api'
import { isStandalone, platform } from './install.svelte'

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

export const pushSupport: PushSupport =
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    ? 'supported'
    : platform === 'ios' && !isStandalone
      ? 'needs-install'
      : 'unsupported'

export function registerServiceWorker(onNavigate: (url: string) => void) {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch((error) => console.error('Service worker failed', error))
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'navigate' && typeof event.data.url === 'string') onNavigate(event.data.url)
  })
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport !== 'supported') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function subscribeDevice(vapidPublicKey: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for Tally Up in your browser or system settings.')
  await navigator.serviceWorker.register('/sw.js')
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) })
  await saveSubscription(subscription)
}

export const saveSubscription = (subscription: PushSubscription) =>
  api('/push-subscriptions', {
    method: 'POST',
    body: { ...(subscription.toJSON() as PushSubscriptionInput), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })

export const idleDeviceState = () => (Notification.permission === 'denied' ? 'blocked' : 'off')

export async function unsubscribeDevice(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await api('/push-subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => {})
  await subscription.unsubscribe()
}
