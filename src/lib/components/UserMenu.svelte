<script lang="ts">
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import { setMode, userPrefersMode } from 'mode-watcher'
  import { toast } from 'svelte-sonner'
  import type { User } from '$shared/api'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import UserAvatar from './UserAvatar.svelte'

  let { user }: { user: User } = $props()

  const THEMES = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const

  async function signOut() {
    const response = await fetch('/auth/logout', { method: 'POST' }).catch(() => null)
    if (!response?.ok) {
      toast.error('Could not sign out. Try again.')
      return
    }
    window.location.replace('/')
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="Account menu">
    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} tone="card" />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-60 rounded-2xl p-1.5">
    <DropdownMenu.Label class="px-2 py-1.5">
      <div class="font-medium">{user.name}</div>
      <div class="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
    </DropdownMenu.Label>
    <DropdownMenu.Separator />
    <DropdownMenu.Label class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Appearance</DropdownMenu.Label>
    <DropdownMenu.RadioGroup value={userPrefersMode.current} onValueChange={(mode) => setMode(mode as (typeof THEMES)[number]['value'])}>
      {#each THEMES as theme (theme.value)}
        <DropdownMenu.RadioItem value={theme.value} class="rounded-lg">{theme.label}</DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={signOut} class="rounded-lg">
      <LogOutIcon />
      Sign out
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
