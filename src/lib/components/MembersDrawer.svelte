<script lang="ts">
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import MemberHonors from './MemberHonors.svelte'
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
      <ul class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4">
        {#each group.members as member (member.id)}
          <li class="py-2">
          <button type="button" class="flex w-full items-center gap-3 rounded-xl py-2 text-left hover:bg-accent" aria-expanded={group.achievementsEnabled ? expanded === member.id : undefined} disabled={!group.achievementsEnabled} onclick={() => expanded = expanded === member.id ? null : member.id}>
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="lg" tone={member.id === user.id ? 'highlight' : 'muted'} />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{member.name}{member.id === user.id ? ' (you)' : ''}{#if group.achievementsEnabled && goal?.crowns?.some((c) => c.userId === member.id)} <span aria-label="Holds crowns">👑</span>{/if}</div>
              {#if group.achievementsEnabled && titleName(member.selectedTitle)}<div class="text-xs text-muted-foreground">{titleName(member.selectedTitle)}</div>{/if}
              <div class="text-xs text-muted-foreground">Joined {joined.format(member.joinedAt)}</div>
            </div>
            {#if member.id === group.ownerId}<Badge variant="highlight">Admin</Badge>{/if}
          </button>
          {#if group.achievementsEnabled && expanded === member.id}<MemberHonors {member} {group} {goal} {today} userId={user.id} />{/if}
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
