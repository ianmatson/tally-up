import { toast } from 'svelte-sonner'
import { api } from './api'
import { unsubscribeDevice } from './push'

export async function signOut() {
  await unsubscribeDevice().catch(() => {})
  const response = await fetch('/auth/logout', { method: 'POST' }).catch(() => null)
  if (!response?.ok) {
    toast.error('Could not sign out. Try again.')
    return
  }
  window.location.replace('/')
}

export async function deleteAccount(userId: string) {
  await api('/me', { method: 'DELETE', body: { userId } })
  await unsubscribeDevice().catch(() => {})
  window.location.replace('/')
}
