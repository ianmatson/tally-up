<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
  import type { GoalDetail, Member } from '$shared/api'
  import { formatAmount } from '$shared/units'
  import { type Standing, todaysStandings } from '$lib/crowns'
  import { formatShare, memberLabel } from '$lib/format'
  import { componentShares, type GoalProgress } from '$lib/progress'
  import { cn } from '$lib/utils'

  let { goal, progress, membersById, userId }: {
    goal: GoalDetail
    progress: GoalProgress
    membersById: Map<string, Member>
    userId: string
  } = $props()

  const standings = $derived(todaysStandings(goal, progress.today))
  const shares = $derived(componentShares(goal.components))
  const rows = $derived([
    { id: 'overall', name: 'Top contributor', standing: standings.overall, done: progress.complete, value: formatShare(standings.overall.contribution) },
    ...progress.components.map(({ component, total }) => {
      const standing = standings.byComponent.get(component.id)!
      const amount = (standing.contribution / shares.get(component.id)!) * component.target
      return { id: component.id, name: component.name, standing, done: total >= component.target, value: formatAmount(amount, component.unit) }
    }),
  ])

  const listFormat = new Intl.ListFormat(undefined, { type: 'conjunction' })

  function leaders({ userIds }: Standing): string {
    const names = userIds.map((id) => memberLabel(membersById, id, userId))
    if (names.length === 1) return names[0] === 'You' ? 'You lead' : `${names[0]} leads`
    return `${listFormat.format(names)} tied`
  }

  function status(standing: Standing, done: boolean): string {
    if (standing.userIds.length === 0) return done ? 'Target reached' : 'No logs yet'
    return done ? `${leaders(standing)} · target reached` : leaders(standing)
  }
</script>

<section class="rise-in rounded-card bg-card p-4 [animation-delay:120ms] sm:p-5" aria-labelledby="crown-race-heading">
  <h2 id="crown-race-heading" class="font-semibold tracking-tight">Today's crowns</h2>
  <p class="mt-1 text-xs text-muted-foreground">Lead at midnight to win. Ties win nothing.</p>
  <ul class="mt-2 divide-y">
    {#each rows as row (row.id)}
      {@const mine = row.standing.userIds.length === 1 && row.standing.userIds[0] === userId}
      <li class="flex items-center gap-3 py-2.5">
        <span
          class={cn('grid size-7 shrink-0 place-items-center rounded-full', mine ? 'bg-highlight text-highlight-foreground' : 'bg-secondary text-muted-foreground')}
          aria-hidden="true"
        >
          <CrownIcon class="size-3.5" />
        </span>
        <div class="min-w-0 flex-1 leading-tight">
          <div class="truncate text-sm font-medium">{row.name}</div>
          <div class="text-xs text-muted-foreground">{status(row.standing, row.done)}</div>
        </div>
        {#if row.standing.userIds.length}<span class="tabular shrink-0 text-sm font-semibold">{row.value}</span>{/if}
      </li>
    {/each}
  </ul>
</section>
