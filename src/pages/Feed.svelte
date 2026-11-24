<script lang="ts">
  import type { Entry, GoalDetail, GroupDetail, User } from '$shared/api'
  import ActivityItem from '$lib/components/ActivityItem.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import { Button } from '$lib/components/ui/button'
  import { formatDayLabel } from '$lib/format'
  import { todayIn } from '$shared/dates'

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
  const entries = $derived(
    (goal?.entries.filter((e) => scope === 'everyone' || e.userId === user.id) ?? []).toSorted(
      (a, b) => b.date.localeCompare(a.date) || b.occurredAt - a.occurredAt,
    ),
  )
  const today = $derived(todayIn(group.timezone, now))
  const days = $derived.by(() => {
    const byDay = new Map<string, Entry[]>()
    for (const entry of entries.slice(0, limit)) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry])
    return [...byDay]
  })
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
    {#each days as [date, dayEntries], i (date)}
      <section class="rise-in" style="animation-delay: {Math.min(i, 4) * 40}ms" aria-label={formatDayLabel(date, today)}>
        <h2 class="mb-2 px-1 text-xs font-medium text-muted-foreground">{formatDayLabel(date, today)}</h2>
        <ul class="flex flex-col divide-y rounded-card bg-card px-4">
          {#each dayEntries as entry (entry.id)}
            <li class="py-3.5">
              <ActivityItem
                {entry}
                {componentsById}
                goalId={goal.id}
                userId={user.id}
                {membersById}
                {now}
                showComments
                compact
                timeZone={group.timezone}
                onOpen={(focus) => onOpen(entry, focus)}
              />
            </li>
          {/each}
        </ul>
      </section>
    {/each}
    {#if entries.length > limit}
      <Button variant="secondary" class="w-full" onclick={() => (limit += PAGE_SIZE)}>Show more</Button>
    {/if}
  {/if}
</div>
