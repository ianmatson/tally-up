<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import Share2Icon from '@lucide/svelte/icons/share-2'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { GoalDetail, GoalInput, GroupDetail, Member } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import GoalForm from '$lib/components/GoalForm.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { formatMembers } from '$lib/format'
  import { allGoalsKey, goalQuery, groupQuery, groupsQuery } from '$lib/queries'
  import { navigate } from '$lib/router.svelte'

  let { group, goal, today }: { group: GroupDetail; goal: GoalDetail | null; today: string } = $props()

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
    <p class="mt-0.5 text-sm text-muted-foreground">Manage {group.name}</p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{goal && goalMode === 'edit' ? 'Current goal' : 'New goal'}</Card.Title>
      <Card.Description>
        {#if goal && goalMode === 'new'}
          The current goal "{goal.name}" moves to History and can no longer be changed.
        {:else if goal}
          Change the dates, targets, or shares of the goal. The dashboard and leaderboard update for everyone.
        {:else}
          Set a time period and one or more things to do together.
        {/if}
      </Card.Description>
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
      <Card.Title>Invite friends</Card.Title>
      <Card.Description>Anyone with this link can join the group.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <Input readonly value={inviteUrl} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
      <div class="flex flex-wrap gap-2">
        {#if canShare}
          <Button onclick={shareInvite}><Share2Icon /> Share</Button>
        {/if}
        <Button variant={canShare ? 'outline' : 'default'} class="min-w-26" onclick={copyInvite}>
          {#if inviteFeedback === 'copied'}<CheckIcon /> Copied{:else}<CopyIcon /> Copy{/if}
        </Button>
        <Button variant="ghost" disabled={resetInvite.isPending} onclick={() => (confirmResetInvite = true)}>
          {#if resetInvite.isPending}
            <RefreshCwIcon class="animate-spin" /> Creating…
          {:else if inviteFeedback === 'renewed'}
            <CheckIcon /> New link created
          {:else}
            <RefreshCwIcon /> New link
          {/if}
        </Button>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Members</Card.Title>
      <Card.Description>{formatMembers(group.members.length)}</Card.Description>
    </Card.Header>
    <Card.Content>
      <ul class="flex flex-col gap-3">
        {#each group.members as member (member.id)}
          <li class="flex items-center gap-3">
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
            {#if member.id === group.ownerId}
              <Badge variant="highlight">Admin</Badge>
            {:else}
              <Button variant="ghost" size="sm" class="-mr-2 text-muted-foreground hover:text-destructive" onclick={() => (memberToRemove = member)}>
                Remove
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Group name</Card.Title>
    </Card.Header>
    <Card.Content>
      <form
        class="flex gap-2"
        onsubmit={(e) => {
          e.preventDefault()
          renameGroup.mutate(groupName.trim())
        }}
      >
        <Input maxlength={LIMITS.name} bind:value={groupName} aria-label="Group name" />
        <Button type="submit" disabled={!groupName.trim() || groupName.trim() === group.name || renameGroup.isPending}>
          Save
        </Button>
      </form>
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
