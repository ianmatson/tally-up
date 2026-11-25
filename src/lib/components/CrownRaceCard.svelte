<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import CrownIcon from '@lucide/svelte/icons/crown'
  import type { GoalDetail, Member } from '$shared/api'
  import { formatAmount } from '$shared/units'
  import { type Standing, todaysStandings } from '$lib/crowns'
  import { formatCountdown, formatShare, memberLabel } from '$lib/format'
  import { expand } from '$lib/motion'
  import { componentShares, type GoalProgress } from '$lib/progress'
  import { cn } from '$lib/utils'

  let { goal, progress, membersById, userId, msLeft }: {
    goal: GoalDetail
    progress: GoalProgress
    membersById: Map<string, Member>
    userId: string
    msLeft: number
  } = $props()

  const PODIUM_SIZE = 3

  let openId = $state<string | null>(null)

  const standings = $derived(todaysStandings(goal, progress.today))
  const shares = $derived(componentShares(goal.components))
  const rows = $derived([
    { id: 'overall', name: 'Top contributor', places: standings.overall, done: progress.complete, format: formatShare },
    ...progress.components.map(({ component, total }) => ({
      id: component.id,
      name: component.name,
      places: standings.byComponent.get(component.id)!,
      done: total >= component.target,
      format: (contribution: number) => formatAmount((contribution / shares.get(component.id)!) * component.target, component.unit),
    })),
  ])

  const listFormat = new Intl.ListFormat(undefined, { type: 'conjunction' })
  const names = ({ userIds }: Standing) => userIds.map((id) => memberLabel(membersById, id, userId))

  function leaders(standing: Standing): string {
    const [name, ...others] = names(standing)
    if (others.length) return `${listFormat.format([name, ...others])} tied`
    return name === 'You' ? 'You lead' : `${name} leads`
  }

  type Row = (typeof rows)[number]

  function chaser({ places: [first, second], format }: Row): string {
    if (!second) return ''
    const label = listFormat.format(names(second))
    return ` · ${label === 'You' ? "You're" : label} ${format(first.contribution - second.contribution)} behind`
  }

  function status(row: Row): string {
    if (row.places.length === 0) return row.done ? 'Target reached' : 'No logs yet'
    return `${leaders(row.places[0])}${chaser(row)}${row.done ? ' · target reached' : ''}`
  }

  function podium(places: Standing[]) {
    const ranked: { id: string; rank: number; contribution: number }[] = []
    for (const { userIds, contribution } of places) {
      if (ranked.length >= PODIUM_SIZE) break
      const rank = ranked.length + 1
      ranked.push(...userIds.map((id) => ({ id, rank, contribution })))
    }
    return ranked
  }
</script>

<section class="rise-in rounded-card bg-card p-4 [animation-delay:120ms] sm:p-5" aria-labelledby="crown-race-heading">
  <div class="flex items-center justify-between gap-3">
    <h2 id="crown-race-heading" class="font-semibold tracking-tight">Today's crowns</h2>
    <span class="tabular shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">Closes in {formatCountdown(msLeft)}</span>
  </div>
  <p class="mt-1 text-xs text-muted-foreground">Whoever leads when the timer ends wins. Ties win nothing.</p>
  <ul class="mt-2 divide-y">
    {#each rows as row (row.id)}
      {@const leader = row.places[0]}
      {@const mine = leader?.userIds.length === 1 && leader.userIds[0] === userId}
      {@const open = !!leader && openId === row.id}
      <li>
        <button
          type="button"
          class="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-accent"
          aria-expanded={leader ? open : undefined}
          disabled={!leader}
          onclick={() => (openId = open ? null : row.id)}
        >
          <span
            class={cn('grid size-7 shrink-0 place-items-center rounded-full', mine ? 'bg-highlight text-highlight-foreground' : 'bg-secondary text-muted-foreground')}
            aria-hidden="true"
          >
            <CrownIcon class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-sm font-medium">{row.name}</span>
            <span class="block text-xs text-muted-foreground">{status(row)}</span>
          </span>
          {#if leader}
            <span class="tabular shrink-0 text-sm font-semibold">{row.format(leader.contribution)}</span>
            <ChevronDownIcon class={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
          {/if}
        </button>
        {#if open}
          <ol class="flex flex-col gap-1.5 pb-3 pl-10" aria-label="{row.name} top {PODIUM_SIZE}" transition:expand>
            {#each podium(row.places) as place (place.id)}
              <li class={cn('flex items-center gap-3 text-sm', place.id === userId && 'font-medium')}>
                <span class="tabular w-3 text-xs text-muted-foreground">{place.rank}</span>
                <span class="min-w-0 flex-1 truncate">{memberLabel(membersById, place.id, userId)}</span>
                <span class="tabular shrink-0 text-muted-foreground">{row.format(place.contribution)}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </li>
    {/each}
  </ul>
</section>
