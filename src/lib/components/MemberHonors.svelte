<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
  import type { GoalDetail, GroupDetail, Member } from '$shared/api'
  import { TITLES, currentStreak } from '$shared/achievements'
  import type { CrownTally } from '$lib/crowns'
  import HatchTrack from './HatchTrack.svelte'

  let { member, group, goal, tally, today }: {
    member: Member; group: GroupDetail; goal: GoalDetail | null; tally: CrownTally | undefined; today: string; userId: string
  } = $props()
  const crowns = $derived(
    tally && goal
      ? [
          { id: 'overall', name: 'Top contributor', count: tally.overall },
          ...goal.components.map((c) => ({ id: c.id, name: c.name, count: tally.byComponent.get(c.id) ?? 0 })),
        ].filter((crown) => crown.count > 0)
      : [],
  )
  const current = $derived(TITLES.find((t) => t.id === member.selectedTitle))
  const streak = $derived(currentStreak(goal?.entries.filter((e) => e.userId === member.id && e.date >= goal.startDate && e.date <= goal.endDate).map((e) => e.date) ?? [], today))
  const next = $derived(TITLES.find((t) => t.days > (current?.days ?? 0)))
</script>

<div class="space-y-4 rounded-[14px] bg-secondary/60 px-4 py-3.5 text-sm">
  {#if goal}
    <section aria-label="Crowns">
      <h3 class="text-xs font-medium text-muted-foreground">Crowns</h3>
      {#if crowns.length}
        <ul class="mt-2 flex flex-wrap gap-1.5">
          {#each crowns as crown (crown.id)}
            <li class="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-card pr-2.5 pl-1 text-xs font-medium">
              <span class="grid size-5 shrink-0 place-items-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true"><CrownIcon class="size-3" /></span>
              <span class="min-w-0 truncate">{crown.name}</span>
              <span class="tabular shrink-0 text-muted-foreground">{crown.count}<span class="sr-only"> {crown.count === 1 ? 'crown' : 'crowns'}</span></span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-1 text-muted-foreground">None yet. Lead a category for a day to earn one.</p>
      {/if}
    </section>
  {/if}

  {#if group.achievementsEnabled}
    <section aria-label="Titles">
      <h3 class="text-xs font-medium text-muted-foreground">Current title</h3>
      {#if current}
        <span class="mt-2 inline-flex h-7 items-center rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground">
          {current.name}
        </span>
      {:else}
        <p class="mt-1 text-muted-foreground">No title yet.</p>
      {/if}
      {#if next}
        <div class="mt-3">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span><span class="text-muted-foreground">Next</span> <span class="font-medium">{next.name}</span></span>
            <span class="tabular text-muted-foreground">{Math.min(streak, next.days)} of {next.days} {next.days === 1 ? 'day' : 'days in a row'}</span>
          </div>
          <div class="mt-1.5"><HatchTrack value={Math.min(streak, next.days) / next.days} size="sm" label="Progress toward {next.name}" /></div>
        </div>
      {:else}
        <p class="mt-2 text-xs text-muted-foreground">Highest title earned.</p>
      {/if}
    </section>
  {/if}
</div>
