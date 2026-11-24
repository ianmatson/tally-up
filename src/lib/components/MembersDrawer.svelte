<script lang="ts">
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { toast } from 'svelte-sonner'
  import { api } from '$lib/api'
  import { crownTallies } from '$lib/crowns'
  import { groupQuery, groupsQuery } from '$lib/queries'
  import { navigate } from '$lib/router.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
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
  let confirmLeave = $state(false)
  const queryClient = useQueryClient()
  const lastMember = $derived(group.members.length === 1)
  const leave = createMutation(() => ({
    mutationFn: () => api(`/groups/${group.id}/membership`, { method: 'DELETE' }),
    onSuccess: async () => {
      open = false
      queryClient.removeQueries({ queryKey: groupQuery(group.id).queryKey })
      await queryClient.invalidateQueries({ queryKey: groupsQuery().queryKey })
      toast.success(lastMember ? 'Group deleted' : `You left ${group.name}`)
      navigate('/')
    },
  }))
  $effect(() => { if (open) expanded = user.id })

  const crowns = $derived(goal ? crownTallies(goal, today) : new Map())
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
          {@const crownCount = crowns.get(member.id)?.total ?? 0}
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
              {#if member.isAdmin}<Badge variant="highlight">Admin</Badge>{/if}
              {#if hasHonors}
                <ChevronDownIcon class={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
              {/if}
            </button>
            {#if isOpen}<div class="pt-1 pb-2" transition:expand><MemberHonors {member} {group} {goal} tally={crowns.get(member.id)} {today} userId={user.id} /></div>{/if}
          </li>
        {/each}
      </ul>
      <Drawer.Footer class="pb-[max(1rem,env(safe-area-inset-bottom))]">
        {#if group.isAdmin}
          <Button href="/g/{group.id}/admin" variant="secondary" size="lg" class="h-12" onclick={() => (open = false)}>Invite or manage members</Button>
        {/if}
        <Button variant="ghost" class="text-muted-foreground hover:text-destructive" disabled={leave.isPending} onclick={() => (confirmLeave = true)}>
          Leave group
        </Button>
      </Drawer.Footer>
    </div>
  </Drawer.Content>
</Drawer.Root>

<ConfirmDialog
  bind:open={confirmLeave}
  title={lastMember ? `Delete ${group.name}?` : `Leave ${group.name}?`}
  description={lastMember
    ? 'You are the only member, so leaving deletes the group and all of its goals.'
    : 'This deletes everything you logged, commented and reacted in this group. If everyone else has left, the group is deleted too.'}
  confirmLabel={lastMember ? 'Delete group' : 'Leave group'}
  onConfirm={() => leave.mutate()}
/>
