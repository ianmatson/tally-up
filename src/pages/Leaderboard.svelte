<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import HatchTrack from '$lib/components/HatchTrack.svelte'
  import ProgressChart from '$lib/components/ProgressChart.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import SearchSelect from '$lib/components/SearchSelect.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { formatNumber, formatPercent, formatPoints, formatWeight, memberLabel } from '$lib/format'
  import { daysBetween } from '$shared/dates'
  import {
    cumulativeByMember,
    dateRange,
    entriesInPeriod,
    memberScores,
    type Period,
    PERIOD_OPTIONS,
    periodRange,
    rankBy,
    targetPoints,
  } from '$lib/progress'
  import { cn } from '$lib/utils'

  const OVERALL = 'overall'
  const PALETTE_SIZE = 8
  const VISIBLE_ROWS = 10
  const MAX_TABS = 10

  let { group, goal, today, user }: { group: GroupDetail; goal: GoalDetail | null; today: string; user: User } = $props()

  let period = $state<Period>('all')
  let view = $state(OVERALL)
  let expanded = $state<string | null>(null)
  let hovered = $state<string | null>(null)
  let showAllRows = $state(false)

  const entries = $derived(goal ? entriesInPeriod(goal, today, period) : [])
  const scores = $derived(goal ? memberScores(group.members, goal.components, entries) : [])
  const selectedComponent = $derived(goal?.components.find((c) => c.id === view))
  const rows = $derived(
    rankBy(scores, (s) => (selectedComponent ? s.byComponent[selectedComponent.id].amount : s.points)),
  )
  const componentTotals = $derived(
    Object.fromEntries(
      (goal?.components ?? []).map((c) => [c.id, scores.reduce((sum, s) => sum + s.byComponent[c.id].amount, 0)]),
    ),
  )
  const colorOrder = $derived(
    group.members.length <= PALETTE_SIZE || !goal
      ? group.members
      : rankBy(memberScores(group.members, goal.components, goal.entries), (s) => s.points).map((r) => r.item.member),
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
    const { start, end } = periodRange(goal, today, period)
    return dateRange(start, end)
  })
  const weights = $derived(new Map(goal?.components.map((c) => [c.id, c.weight]) ?? []))
  const chartSeries = $derived.by(() => {
    const valueOf = (e: (typeof entries)[number]) =>
      selectedComponent ? (e.componentId === selectedComponent.id ? e.amount : 0) : e.amount * weights.get(e.componentId)!
    const totals = cumulativeByMember(group.members, entries, days, valueOf)
    return group.members.map((m) => ({
      id: m.id,
      name: memberLabel(membersById, m.id, user.id),
      color: memberColor(m.id),
      values: totals.get(m.id) ?? [],
    }))
  })
  const evenShare = $derived.by(() => {
    if (!goal || period !== 'all' || days.length === 0) return null
    const groupTarget = selectedComponent ? selectedComponent.target : targetPoints(goal.components)
    const share = groupTarget / group.members.length
    const goalDays = daysBetween(goal.startDate, goal.endDate) + 1
    return days.map((_, i) => (share * (i + 1)) / goalDays)
  })
  const chartFormat = (n: number) => (selectedComponent ? formatNumber(n) : formatPoints(n))
  const chartLabel = $derived(
    `Cumulative ${selectedComponent ? `${selectedComponent.name.toLowerCase()} (${selectedComponent.unit})` : 'points'} by member`,
  )

  const viewOptions = $derived([
    { value: OVERALL, label: 'Overall' },
    ...(goal?.components.map((c) => ({ value: c.id, label: c.name })) ?? []),
  ])
</script>

<div class="mx-auto max-w-2xl">
  <div class="rise-in pt-4 pb-5">
    <div class="flex items-center justify-between gap-3">
      <h1 class="page-title">Leaderboard</h1>
      {#if goal}
        <PillTabs bind:value={period} label="Period" options={PERIOD_OPTIONS} />
      {/if}
    </div>
    {#if goal}<p class="mt-0.5 truncate text-sm text-muted-foreground">{goal.name}{goal.archived ? ' · past goal' : ''}</p>{/if}
  </div>

  {#if !goal}
    <p class="rounded-card bg-card px-5 py-8 text-center text-sm text-muted-foreground">The leaderboard starts when the group has a goal.</p>
  {:else}
    {#if goal.components.length > MAX_TABS}
      <SearchSelect bind:value={view} label="Ranking" placeholder="Search activities" options={viewOptions} class="mb-3 bg-card sm:w-72" />
    {:else}
      <div class="-mx-4 mb-3 overflow-x-auto px-4 pr-10 [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] sm:mx-0 sm:px-0 sm:pr-10">
        <PillTabs bind:value={view} label="Ranking" size="md" options={viewOptions} />
      </div>
    {/if}

    {#if days.length > 0}
      <section class="rise-in mb-3 rounded-card bg-card p-4 sm:p-5" aria-labelledby="chart-heading">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="chart-heading" class="font-semibold tracking-tight">Progress over time</h2>
          <span class="text-xs text-muted-foreground">
            {selectedComponent ? `${selectedComponent.name} (${selectedComponent.unit})` : 'Points'}{evenShare ? '' : ' · last 7 days'}
          </span>
        </div>
        <ProgressChart
          {days}
          series={chartSeries}
          reference={evenShare}
          format={chartFormat}
          label={chartLabel}
          focusId={hovered ?? expanded}
          highlightId={user.id}
        />
        {#if evenShare}
          <p class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span class="w-4 border-t-[1.5px] border-dashed border-muted-foreground"></span>
            Even share: where each person would be if everyone did an equal part
          </p>
        {/if}
      </section>
    {/if}

    <ol class="rise-in flex flex-col gap-2">
      {#each visibleRows as row (row.item.member.id)}
        {@const member = row.item.member}
        {@const isMe = member.id === user.id}
        {@const isOpen = expanded === member.id && !selectedComponent}
        <li
          class={cn('overflow-hidden rounded-card bg-card', isMe && 'ring-2 ring-highlight')}
          onpointerenter={() => (hovered = member.id)}
          onpointerleave={() => (hovered = null)}
        >
          <button
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
            aria-expanded={selectedComponent ? undefined : isOpen}
            disabled={!!selectedComponent}
            onclick={() => (expanded = isOpen ? null : member.id)}
          >
            <span class="tabular w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{row.rank}</span>
            <span class="h-[3px] w-3 shrink-0 rounded-full" style="background: {memberColor(member.id)}" aria-hidden="true"></span>
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} tone={isMe ? 'highlight' : 'muted'} />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{member.name}{isMe ? ' (you)' : ''}</div>
              <div class="mt-2 max-w-48"><HatchTrack value={row.share} size="sm" label="Share of group" /></div>
            </div>
            <div class="shrink-0 text-right">
              <div class="tabular font-semibold">{selectedComponent ? formatNumber(row.value) : formatPoints(row.value)}</div>
              <div class="text-xs text-muted-foreground">{selectedComponent ? selectedComponent.unit : 'pts'} · {formatPercent(row.share)}</div>
            </div>
            {#if !selectedComponent}
              <ChevronDownIcon class={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
            {/if}
          </button>
          {#if isOpen}
            <dl class="mx-3 mb-3 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 rounded-[14px] bg-secondary/60 px-4 py-3 text-sm">
              {#each goal.components as component (component.id)}
                {@const part = row.item.byComponent[component.id]}
                {@const total = componentTotals[component.id]}
                <dt class="truncate">{component.name}</dt>
                <dd class="tabular text-right text-muted-foreground">
                  {formatNumber(part.amount)} {component.unit}{#if total > 0}&nbsp;·&nbsp;{formatPercent(part.amount / total)}{/if}
                </dd>
                <dd class="tabular text-right font-medium">{formatPoints(part.points)} pts</dd>
              {/each}
            </dl>
          {/if}
        </li>
      {/each}
    </ol>
    {#if visibleRows.length < rows.length}
      <Button variant="secondary" class="mt-3 w-full" onclick={() => (showAllRows = true)}>Show all {rows.length} members</Button>
    {/if}

    <section class="mt-6 rounded-card bg-card p-5">
      <h2 class="font-semibold tracking-tight">How scoring works</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Every activity has a point value per unit, so harder work counts for more. Your score is everything you log × its
        points. The bar shows your share of the group's points.
      </p>
      <dl class="mt-4 flex flex-col divide-y text-sm">
        {#each goal.components as component (component.id)}
          <div class="flex items-baseline justify-between gap-3 py-2.5">
            <dt class="font-medium">{component.name}</dt>
            <dd class="tabular text-right">
              {formatWeight(component.weight)} pts / {component.unit}
              <span class="block text-xs text-muted-foreground">{formatPoints(component.target * component.weight)} pts at target</span>
            </dd>
          </div>
        {/each}
      </dl>
    </section>
  {/if}
</div>
