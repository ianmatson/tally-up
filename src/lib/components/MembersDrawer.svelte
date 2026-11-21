<script lang="ts">
  import type { GroupDetail, User } from '$shared/api'
  import { formatMembers } from '$lib/format'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
  import UserAvatar from './UserAvatar.svelte'

  let { open = $bindable(false), group, user }: { open: boolean; group: GroupDetail; user: User } = $props()

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
          <li class="flex items-center gap-3 py-2">
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="lg" tone={member.id === user.id ? 'highlight' : 'muted'} />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{member.name}{member.id === user.id ? ' (you)' : ''}</div>
              <div class="text-xs text-muted-foreground">Joined {joined.format(member.joinedAt)}</div>
            </div>
            {#if member.id === group.ownerId}<Badge variant="highlight">Admin</Badge>{/if}
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
