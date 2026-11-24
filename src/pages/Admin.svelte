<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import UserMinusIcon from '@lucide/svelte/icons/user-minus'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import Share2Icon from '@lucide/svelte/icons/share-2'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { GoalDetail, GoalInput, GroupDetail, Member, User } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import GoalForm from '$lib/components/GoalForm.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { formatMembers } from '$lib/format'
  import { allGoalsKey, goalQuery, groupQuery, groupsQuery } from '$lib/queries'
  import { navigate } from '$lib/router.svelte'
  import { cn } from '$lib/utils'

  let { group, goal, today, user }: { group: GroupDetail; goal: GoalDetail | null; today: string; user: User } = $props()

  const queryClient = useQueryClient()
  const inviteUrl = $derived(`${window.location.origin}/join/${group.inviteCode}`)
  const canShare = typeof navigator.share === 'function'
  const goalDefinition = $derived(
    goal ? JSON.stringify([goal.id, goal.name, goal.startDate, goal.endDate, goal.components]) : '',
  )

  let goalMode = $state<'edit' | 'new'>('edit')
  let groupName = $state(untrack(() => group.name))
  let memberToRemove = $state<Member | null>(null)
  let confirmResetInvite = $state(false)

  const refreshGroup = () => queryClient.invalidateQueries({ queryKey: groupQuery(group.id).queryKey })

  const saveGoal = createMutation(() => ({
    mutationFn: (input: GoalInput) => api<GoalDetail>(`/goals/${goal!.id}`, { method: 'PUT', body: input }),
    onSuccess: (saved) => {
      queryClient.setQueryData(goalQuery(saved.id).queryKey, saved)
      refreshGroup()
      toast.success('Goal saved')
    },
  }))

  const createGoal = createMutation(() => ({
    mutationFn: (input: GoalInput) => api(`/groups/${group.id}/goals`, { method: 'POST', body: input }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: allGoalsKey })
      await refreshGroup()
      goalMode = 'edit'
      toast.success('Goal created')
      navigate(`/g/${group.id}`)
    },
  }))

  const renameGroup = createMutation(() => ({
    mutationFn: (name: string) => api(`/groups/${group.id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => {
      refreshGroup()
      queryClient.invalidateQueries({ queryKey: groupsQuery().queryKey })
      toast.success('Group renamed')
    },
  }))

  const resetInvite = createMutation(() => ({
    mutationFn: () => api(`/groups/${group.id}/invite-code`, { method: 'POST' }),
    onSuccess: async () => {
      await refreshGroup()
      showFeedback('renewed')
    },
  }))

  const setRole = createMutation(() => ({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'member' | 'admin' }) =>
      api(`/groups/${group.id}/members/${memberId}/role`, { method: 'PUT', body: { role } }),
    onSuccess: (_, { role }) => {
      refreshGroup()
      toast.success(role === 'admin' ? 'Admin added' : 'Admin removed')
    },
  }))

  const removeMember = createMutation(() => ({
    mutationFn: (memberId: string) => api(`/groups/${group.id}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refreshGroup()
      queryClient.invalidateQueries({ queryKey: allGoalsKey })
      toast.success('Member removed')
    },
  }))

  const FEEDBACK_MS = 2000
  let inviteFeedback = $state<'copied' | 'renewed' | null>(null)
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined

  function showFeedback(kind: 'copied' | 'renewed') {
    inviteFeedback = kind
    clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => (inviteFeedback = null), FEEDBACK_MS)
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    showFeedback('copied')
  }

  function shareInvite() {
    navigator.share({ title: `Join ${group.name}`, text: `Join ${group.name} on Tally Up`, url: inviteUrl }).catch(() => {})
  }
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-3">
  <div class="rise-in pt-4 pb-2">
    <h1 class="page-title">Admin</h1>
    <p class="mt-0.5 text-sm text-muted-foreground">{group.name}</p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{goal && goalMode === 'edit' ? 'Current goal' : 'New goal'}</Card.Title>
      {#if goal && goalMode === 'new'}
        <Card.Description>The current goal "{goal.name}" moves to History and can no longer be changed.</Card.Description>
      {:else if !goal}
        <Card.Description>Set a time period and one or more things to do together.</Card.Description>
      {/if}
      {#if goal}
        <Card.Action>
          <Button variant="outline" size="sm" onclick={() => (goalMode = goalMode === 'edit' ? 'new' : 'edit')}>
            {goalMode === 'edit' ? 'New goal' : 'Cancel'}
          </Button>
        </Card.Action>
      {/if}
    </Card.Header>
    <Card.Content>
      {#if goal && goalMode === 'edit'}
        {#key goalDefinition}
          <GoalForm initial={goal} {today} submitLabel="Save goal" pending={saveGoal.isPending} onSubmit={saveGoal.mutate} />
        {/key}
      {:else}
        <GoalForm
          initial={null}
          {today}
          submitLabel={goal ? 'Start new goal' : 'Create goal'}
          pending={createGoal.isPending}
          onSubmit={createGoal.mutate}
        />
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Group</Card.Title>
      <Card.Description>{formatMembers(group.members.length)}</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-5">
      <form
        class="flex gap-2"
        onsubmit={(e) => {
          e.preventDefault()
          renameGroup.mutate(groupName.trim())
        }}
      >
        <Input maxlength={LIMITS.name} bind:value={groupName} aria-label="Group name" />
        <Button type="submit" disabled={!groupName.trim() || groupName.trim() === group.name || renameGroup.isPending}>
          Rename
        </Button>
      </form>
      <div class="flex flex-col gap-2">
        <Label for="invite-link">Invite link</Label>
        <div class="flex gap-2">
          <Input id="invite-link" readonly value={inviteUrl} onfocus={(e) => e.currentTarget.select()} />
          <Button variant="secondary" size="icon" class="size-11 shrink-0" aria-label="Copy invite link" onclick={copyInvite}>
            {#if inviteFeedback === 'copied'}<CheckIcon />{:else}<CopyIcon />{/if}
          </Button>
          {#if canShare}
            <Button variant="secondary" size="icon" class="size-11 shrink-0" aria-label="Share invite link" onclick={shareInvite}><Share2Icon /></Button>
          {/if}
        </div>
        <span class="sr-only" role="status">{inviteFeedback === 'copied' ? 'Invite link copied' : inviteFeedback === 'renewed' ? 'New invite link created' : ''}</span>
        <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Anyone with the link can join.</span>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-full font-medium hover:text-foreground disabled:opacity-60"
            disabled={resetInvite.isPending}
            onclick={() => (confirmResetInvite = true)}
          >
            {#if inviteFeedback === 'renewed'}<CheckIcon class="size-3.5" />{:else}<RefreshCwIcon class={cn('size-3.5', resetInvite.isPending && 'animate-spin')} />{/if}
            New link
          </button>
        </div>
      </div>
      <ul class="flex flex-col gap-3">
        {#each group.members as member (member.id)}
          <li class="flex items-center gap-3">
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{member.name}{member.id === user.id ? ' (you)' : ''}</span>
            {#if member.isAdmin}<Badge variant="highlight">Admin</Badge>{/if}
            {#if member.id !== user.id}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label="Manage {member.name}"
                >
                  <EllipsisIcon class="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-48 rounded-2xl p-1.5">
                  <DropdownMenu.Item class="rounded-lg" onSelect={() => setRole.mutate({ memberId: member.id, role: member.isAdmin ? 'member' : 'admin' })}>
                    <ShieldIcon />
                    {member.isAdmin ? 'Remove admin' : 'Make admin'}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item class="rounded-lg text-destructive data-highlighted:text-destructive" onSelect={() => (memberToRemove = member)}>
                    <UserMinusIcon class="text-destructive" />
                    Remove from group
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            {/if}
          </li>
        {/each}
      </ul>
    </Card.Content>
  </Card.Root>

</div>

<ConfirmDialog
  bind:open={() => memberToRemove !== null, (open) => !open && (memberToRemove = null)}
  title="Remove {memberToRemove?.name}?"
  description="This also deletes everything they logged, commented and reacted in this group. They can join again with the invite link."
  confirmLabel="Remove"
  onConfirm={() => memberToRemove && removeMember.mutate(memberToRemove.id)}
/>

<ConfirmDialog
  bind:open={confirmResetInvite}
  title="Create a new invite link?"
  description="The current link stops working. Current members stay in the group."
  confirmLabel="Create new link"
  onConfirm={() => resetInvite.mutate()}
/>
