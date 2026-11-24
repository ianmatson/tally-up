<script lang="ts">
  import MemberHonors from '$lib/components/MemberHonors.svelte'
  import MemberNameLine from '$lib/components/MemberNameLine.svelte'
  import { formatAmount, unitPlural } from '$shared/units'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import ProgressChart from '$lib/components/ProgressChart.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'
  import { formatNumber, formatPercent, formatShare, memberLabel } from '$lib/format'
  import { daysBetween } from '$shared/dates'
  import {
    componentShares,
    creditEntries,
    cumulativeByMember,
    dateRange,
    memberScores,
    periodRange,
    rankBy,
  } from '$lib/progress'
  import { crownTallies } from '$lib/crowns'
  import { expand } from '$lib/motion'
  import { cn } from '$lib/utils'

  const OVERALL = 'overall'
  const PALETTE_SIZE = 8
  const VISIBLE_ROWS = 10
  const MIN_SHARE_SCALE = 0.01

  let { group, goal, today, user }: { group: GroupDetail; goal: GoalDetail | null; today: string; user: User } = $props()

  let view = $state(OVERALL)
  let expanded = $state<string | null>(null)
  let hovered = $state<string | null>(null)
  let showAllRows = $state(false)
  let showScoring = $state(false)

  const credited = $derived(goal ? creditEntries(goal) : [])
  const crowns = $derived(goal ? crownTallies(goal, today) : new Map())
  const scores = $derived(goal ? memberScores(group.members, goal.components, credited) : [])
  const selectedComponent = $derived(goal?.components.find((c) => c.id === view))
  const rows = $derived(
    rankBy(scores, (s) =>
      selectedComponent ? s.byComponent[selectedComponent.id].contribution / shares.get(selectedComponent.id)! : s.contribution,
    ),
  )
  const componentTotals = $derived(
    Object.fromEntries(
      (goal?.components ?? []).map((c) => [c.id, scores.reduce((sum, s) => sum + s.byComponent[c.id].amount, 0)]),
    ),
  )
  const colorOrder = $derived(
    group.members.length <= PALETTE_SIZE || !goal
      ? group.members
      : rankBy(memberScores(group.members, goal.components, credited), (s) => s.contribution).map((r) => r.item.member),
  )
  const colors = $derived(
    new Map(colorOrder.map((m, i) => [m.id, i < PALETTE_SIZE ? `var(--series-${i + 1})` : 'var(--series-other)'])),
  )
  const membersById = $derived(new Map(group.members.map((m) => [m.id, m])))
  const visibleRows = $derived.by(() => {
    if (showAllRows || rows.length <= VISIBLE_ROWS + 1) return rows
    const top = rows.slice(0, VISIBLE_ROWS)
    const me = rows.find((r) => r.item.member.id === user.id)
    return me && !top.includes(me) ? [...top, me] : top
  })
  const memberColor = (memberId: string) => colors.get(memberId)!

  const days = $derived.by(() => {
    if (!goal) return []
    const { start, end } = periodRange(goal, today, 'all')
    return dateRange(start, end)
  })
  const shares = $derived(componentShares(goal?.components ?? []))
  const chartSeries = $derived.by(() => {
    const valueOf = (e: (typeof credited)[number]) =>
      selectedComponent ? (e.componentId === selectedComponent.id ? e.amount : 0) : e.contribution
    const totals = cumulativeByMember(group.members, credited, days, valueOf)
    return group.members.map((m) => ({
      id: m.id,
      name: memberLabel(membersById, m.id, user.id),
      color: memberColor(m.id),
      values: totals.get(m.id) ?? [],
    }))
  })
  const evenShare = $derived.by(() => {
    if (!goal || days.length === 0) return null
    const groupTarget = selectedComponent ? selectedComponent.target : 1
    const share = groupTarget / group.members.length
    const goalDays = daysBetween(goal.startDate, goal.endDate) + 1
    return days.map((_, i) => (share * (i + 1)) / goalDays)
  })
  const chartFormat = (n: number) => (selectedComponent ? formatNumber(n) : formatShare(n))
  const chartLabel = $derived(
    `Cumulative ${selectedComponent ? `${selectedComponent.name.toLowerCase()} (${unitPlural(selectedComponent.unit)})` : 'share of the goal'} by member`,
  )

  const viewOptions = $derived([
    { value: OVERALL, label: 'Overall' },
    ...(goal?.components.map((c) => ({ value: c.id, label: c.name })) ?? []),
  ])
  const viewLabel = $derived(viewOptions.find((o) => o.value === view)?.label)
</script>

<div class="mx-auto max-w-2xl">
  <div class="rise-in pt-4 pb-5">
    <div class="flex items-center justify-between gap-3">
      <h1 class="page-title">Leaderboard</h1>
      {#if goal}
        <Select.Root type="single" bind:value={view}>
          <Select.Trigger aria-label="Ranking: {viewLabel}" class="h-9 max-w-44 min-w-0 rounded-full border-0 bg-secondary px-3.5 font-medium shadow-none dark:bg-secondary">
            <span class="truncate">{viewLabel}</span>
          </Select.Trigger>
          <Select.Content align="end" class="rounded-2xl">
            {#each viewOptions as option (option.value)}
              <Select.Item value={option.value} label={option.label} class="rounded-xl">{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/if}
    </div>
    {#if goal}<p class="mt-0.5 truncate text-sm text-muted-foreground">{goal.name}{goal.archived ? ' · past goal' : ''}</p>{/if}
  </div>

  {#if !goal}
    <p class="rounded-card bg-card px-5 py-8 text-center text-sm text-muted-foreground">The leaderboard starts when the group has a goal.</p>
  {:else}
    {#if days.length > 0}
      <section class="rise-in mb-3 rounded-card bg-card p-4 sm:p-5" aria-labelledby="chart-heading">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="chart-heading" class="font-semibold tracking-tight">Progress over time</h2>
          <span class="text-xs text-muted-foreground">
            {selectedComponent ? `${selectedComponent.name} (${unitPlural(selectedComponent.unit)})` : 'Share of goal'}
          </span>
        </div>
        <ProgressChart
          {days}
          series={chartSeries}
          reference={evenShare}
          format={chartFormat}
          minScale={selectedComponent ? 1 : MIN_SHARE_SCALE}
          label={chartLabel}
          focusId={hovered ?? expanded}
          highlightId={user.id}
        />
        {#if evenShare}
          <p class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span class="w-4 border-t-[1.5px] border-dashed border-muted-foreground"></span>
            Even share if everyone does an equal part
          </p>
        {/if}
      </section>
    {/if}

    <ol class="rise-in flex flex-col gap-2">
      {#each visibleRows as row (row.item.member.id)}
        {@const member = row.item.member}
        {@const isMe = member.id === user.id}
        {@const isOpen = expanded === member.id}
        <li
          class={cn('overflow-hidden rounded-card bg-card', isMe && 'ring-2 ring-highlight')}
          onpointerenter={() => (hovered = member.id)}
          onpointerleave={() => (hovered = null)}
        >
          <button
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            aria-expanded={isOpen}
            onclick={() => (expanded = isOpen ? null : member.id)}
          >
            <span class="tabular w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{row.rank}</span>
            <span class="h-[3px] w-3 shrink-0 rounded-full" style="background: {memberColor(member.id)}" aria-hidden="true"></span>
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} tone={isMe ? 'highlight' : 'muted'} />
            <div class="min-w-0 flex-1">
              <MemberNameLine {member} label={member.name} crowns={crowns.get(member.id)?.total} showTitle={!!group.achievementsEnabled} class="text-sm" />
              {#if isMe}<span class="sr-only">(you)</span>{/if}
            </div>
            <div class="shrink-0 text-right">
              <div class="tabular font-semibold">{formatShare(row.value)}</div>
              <span class="sr-only">of the {selectedComponent ? `${selectedComponent.name} target` : 'goal'}</span>
            </div>
            <ChevronDownIcon class={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
          {#if isOpen}
            <div class="pb-3" transition:expand>
              <dl class="mx-3 mb-3 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 rounded-[14px] bg-secondary/60 px-4 py-3 text-sm">
                {#each goal.components as component (component.id)}
                  {@const part = row.item.byComponent[component.id]}
                  {@const total = componentTotals[component.id]}
                  <dt class="truncate">{component.name}</dt>
                  <dd class="tabular text-right text-muted-foreground">
                    {formatAmount(part.amount, component.unit)}{#if total > 0}&nbsp;·&nbsp;{formatPercent(part.amount / total)}{/if}
                  </dd>
                  <dd class="tabular text-right font-medium">{formatShare(part.contribution)}</dd>
                {/each}
              </dl>
              <div class="mx-3"><MemberHonors {member} {group} {goal} tally={crowns.get(member.id)} {today} userId={user.id} /></div>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    {#if visibleRows.length < rows.length}
      <Button variant="secondary" class="mt-3 w-full" onclick={() => (showAllRows = true)}>Show all {rows.length} members</Button>
    {/if}

    <section class="mt-6 rounded-card bg-card px-5 py-3">
      <button
        type="button"
        class="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-xl px-2 py-2 text-left font-semibold tracking-tight transition-colors hover:bg-accent"
        aria-expanded={showScoring}
        onclick={() => (showScoring = !showScoring)}
      >
        How scoring works
        <ChevronDownIcon class={cn('size-4 text-muted-foreground transition-transform duration-200', showScoring && 'rotate-180')} />
      </button>
      {#if showScoring}
        <div transition:expand>
          <p class="pt-1 text-sm text-muted-foreground">
            Each activity is a fixed share of the goal, and logs past an activity's target do not count. Overall shows your share of
            the goal. An activity tab shows your share of that activity's target.
          </p>
          <dl class="mt-3 flex flex-col divide-y pb-2 text-sm">
            {#each goal.components as component (component.id)}
              <div class="flex items-baseline justify-between gap-3 py-2.5">
                <dt class="font-medium">{component.name}</dt>
                <dd class="tabular text-right">
                  {formatShare(shares.get(component.id) ?? 0)} of goal
                  <span class="block text-xs text-muted-foreground">Target {formatAmount(component.target, component.unit)}</span>
                </dd>
              </div>
            {/each}
          </dl>
        </div>
      {/if}
    </section>
  {/if}
</div>
