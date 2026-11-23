<script lang="ts">
  import type { Entry, GoalDetail, GroupDetail, User } from '$shared/api'
  import ActivityItem from '$lib/components/ActivityItem.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import { Button } from '$lib/components/ui/button'

  const PAGE_SIZE = 20

  let { group, goal, now, user, canLog, onOpen }: {
    group: GroupDetail
    goal: GoalDetail | null
    now: Date
    user: User
    canLog: boolean
    onOpen: (entry: Entry, focusComposer: boolean) => void
  } = $props()

  let scope = $state<'everyone' | 'mine'>('everyone')
  let limit = $state(PAGE_SIZE)

  const componentsById = $derived(new Map(goal?.components.map((c) => [c.id, c]) ?? []))
  const membersById = $derived(new Map(group.members.map((m) => [m.id, m])))
  const entries = $derived(goal?.entries.filter((e) => scope === 'everyone' || e.userId === user.id) ?? [])
</script>

<div class="mx-auto flex max-w-xl flex-col gap-3">
  <div class="rise-in flex items-end justify-between gap-3 pt-4 pb-2">
    <div class="min-w-0">
      <h1 class="page-title">Feed</h1>
      {#if goal}<p class="mt-0.5 truncate text-sm text-muted-foreground">{goal.name}</p>{/if}
    </div>
    {#if goal}
      <PillTabs bind:value={scope} label="Feed filter" options={[{ value: 'everyone', label: 'Everyone' }, { value: 'mine', label: 'Mine' }]} />
    {/if}
  </div>

  {#if !goal}
    <p class="rounded-card bg-card px-5 py-8 text-center text-sm text-muted-foreground">There is no goal yet, so there is nothing in the feed.</p>
  {:else if entries.length === 0}
    <p class="rounded-card bg-card px-5 py-8 text-center text-sm text-muted-foreground">
      {canLog && !goal.archived ? 'Nothing logged yet. Tap + to add the first tally.' : 'Nothing was logged.'}
    </p>
  {:else}
    <ul class="flex flex-col gap-3">
      {#each entries.slice(0, limit) as entry, i (entry.id)}
        <li class="rise-in rounded-card bg-card p-4" style="animation-delay: {Math.min(i, 6) * 40}ms">
          <ActivityItem
            {entry}
            achievementsEnabled={group.achievementsEnabled}
            crowns={goal.crowns}
            component={componentsById.get(entry.componentId)}
            goalId={goal.id}
            userId={user.id}
            {membersById}
            {now}
            showComments
            onOpen={(focus) => onOpen(entry, focus)}
          />
        </li>
      {/each}
    </ul>
    {#if entries.length > limit}
      <Button variant="secondary" class="w-full" onclick={() => (limit += PAGE_SIZE)}>Show more</Button>
    {/if}
  {/if}
</div>
