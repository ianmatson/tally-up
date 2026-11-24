<script lang="ts">
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import CrownBadge from './CrownBadge.svelte'
  import MemberHonors from './MemberHonors.svelte'
  import { expand } from '$lib/motion'
  import { cn } from '$lib/utils'
  import { titleName } from '$shared/achievements'
  import { formatMembers } from '$lib/format'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
  import UserAvatar from './UserAvatar.svelte'

  let { open = $bindable(false), group, user, goal, today }: { open: boolean; group: GroupDetail; user: User; goal: GoalDetail | null; today: string } = $props()

  let expanded = $state<string | null>(null)
  $effect(() => { if (open) expanded = user.id })

  const hasHonors = $derived(!!goal || !!group.achievementsEnabled)
  const joined = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
</script>

<Drawer.Root bind:open>
  <Drawer.Content>
    <div class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
      <Drawer.Header class="relative px-4 pt-3 pb-3 text-left">
        <Drawer.Title class="pr-10 text-xl font-semibold tracking-tight">Members</Drawer.Title>
        <Drawer.Description>{group.name} · {formatMembers(group.members.length)}</Drawer.Description>
        <DrawerCloseButton />
      </Drawer.Header>
      <ul class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        {#each group.members as member (member.id)}
          {@const crownCount = goal?.crowns?.filter((c) => c.userId === member.id).length ?? 0}
          {@const isOpen = hasHonors && expanded === member.id}
          <li>
            <button
              type="button"
              class="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-accent"
              aria-expanded={hasHonors ? isOpen : undefined}
              disabled={!hasHonors}
              onclick={() => (expanded = isOpen ? null : member.id)}
            >
              <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="lg" tone={member.id === user.id ? 'highlight' : 'muted'} />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="truncate font-medium">{member.name}{member.id === user.id ? ' (you)' : ''}</span>
                  {#if crownCount}<CrownBadge count={crownCount} />{/if}
                </div>
                <div class="truncate text-xs text-muted-foreground">
                  {[group.achievementsEnabled && titleName(member.selectedTitle), `Joined ${joined.format(member.joinedAt)}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              {#if member.id === group.ownerId}<Badge variant="highlight">Admin</Badge>{/if}
              {#if hasHonors}
                <ChevronDownIcon class={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
              {/if}
            </button>
            {#if isOpen}<div class="pt-1 pb-2" transition:expand><MemberHonors {member} {group} {goal} {today} userId={user.id} /></div>{/if}
          </li>
        {/each}
      </ul>
      {#if group.isOwner}
        <Drawer.Footer class="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button href="/g/{group.id}/admin" variant="secondary" size="lg" class="h-12" onclick={() => (open = false)}>Invite or manage members</Button>
        </Drawer.Footer>
      {:else}
        <div class="h-[max(1rem,env(safe-area-inset-bottom))]"></div>
      {/if}
    </div>
  </Drawer.Content>
</Drawer.Root>
