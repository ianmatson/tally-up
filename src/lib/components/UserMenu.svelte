<script lang="ts">
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import type { User } from '$shared/api'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { navigate } from '$lib/router.svelte'
  import { signOut } from '$lib/session'
  import UserAvatar from './UserAvatar.svelte'

  let { user, adminGroupId = null }: { user: User; adminGroupId?: string | null } = $props()
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
    {#if adminGroupId}
      <DropdownMenu.Item onSelect={() => navigate(`/g/${adminGroupId}/admin`)} class="rounded-lg">
        <ShieldIcon />
        Group admin
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Item onSelect={() => navigate('/settings')} class="rounded-lg">
      <SettingsIcon />
      Settings
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={signOut} class="rounded-lg">
      <LogOutIcon />
      Sign out
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
