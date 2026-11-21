<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'
  import { createQuery } from '@tanstack/svelte-query'
  import type { User } from '$shared/api'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { groupsQuery } from '$lib/queries'
  import { navigate } from '$lib/router.svelte'
  import BrandMark from './BrandMark.svelte'
  import UserMenu from './UserMenu.svelte'

  let { user, currentGroup = null }: { user: User; currentGroup?: { id: string; name: string } | null } = $props()

  let switcherOpen = $state(false)
  const groups = createQuery(() => ({ ...groupsQuery(), enabled: switcherOpen }))
</script>

<header class="sticky top-0 z-30 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
  <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
    <a href="/" class="flex items-center gap-2.5 rounded-full text-[0.95rem] font-semibold tracking-tight" aria-label="Tally Up home">
      <BrandMark />
      <span>Tally Up</span>
    </a>
    <div class="flex-1"></div>
    {#if currentGroup}
      <DropdownMenu.Root bind:open={switcherOpen}>
        <DropdownMenu.Trigger
          class="flex h-9 max-w-[11rem] items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:max-w-xs"
        >
          <span class="truncate">{currentGroup.name}</span>
          <ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-64 rounded-2xl p-1.5">
          <DropdownMenu.Label class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Your groups</DropdownMenu.Label>
          {#each groups.data ?? [] as group (group.id)}
            <DropdownMenu.Item class="rounded-lg" onSelect={() => navigate(`/g/${group.id}`)}>
              <span class="flex-1 truncate">{group.name}</span>
              {#if group.id === currentGroup.id}<CheckIcon class="text-foreground" />{/if}
            </DropdownMenu.Item>
          {/each}
          <DropdownMenu.Separator />
          <DropdownMenu.Item class="rounded-lg" onSelect={() => navigate('/')}>
            <LayoutGridIcon />
            All groups
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
    <UserMenu {user} />
  </div>
</header>
