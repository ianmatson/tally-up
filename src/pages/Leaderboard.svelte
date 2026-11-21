<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import type { GoalDetail, GroupDetail, User } from '$shared/api'
  import HatchTrack from '$lib/components/HatchTrack.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { formatNumber, formatPercent, formatPoints, formatWeight } from '$lib/format'
  import { entriesInPeriod, memberScores, type Period, PERIOD_OPTIONS, rankBy } from '$lib/progress'
  import { cn } from '$lib/utils'

  const OVERALL = 'overall'

  let { group, goal, today, user }: { group: GroupDetail; goal: GoalDetail | null; today: string; user: User } = $props()

  let period = $state<Period>('all')
  let view = $state(OVERALL)
  let expanded = $state<string | null>(null)

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
    <div class="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <PillTabs bind:value={view} label="Ranking" size="md" options={viewOptions} />
    </div>

    <ol class="rise-in flex flex-col gap-2">
      {#each rows as row (row.item.member.id)}
        {@const member = row.item.member}
        {@const isMe = member.id === user.id}
        {@const isOpen = expanded === member.id && !selectedComponent}
        <li class={cn('overflow-hidden rounded-card bg-card', isMe && 'ring-2 ring-highlight')}>
          <button
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
            aria-expanded={selectedComponent ? undefined : isOpen}
            disabled={!!selectedComponent}
            onclick={() => (expanded = isOpen ? null : member.id)}
          >
            <span class="tabular w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{row.rank}</span>
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
