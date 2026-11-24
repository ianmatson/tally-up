<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { toast } from 'svelte-sonner'
  import CheckIcon from '@lucide/svelte/icons/check'
  import CrownIcon from '@lucide/svelte/icons/crown'
  import type { GoalDetail, GroupDetail, Member } from '$shared/api'
  import { TITLES, currentStreak, type TitleId } from '$shared/achievements'
  import { api } from '$lib/api'
  import { crownTallies } from '$lib/crowns'
  import { cn } from '$lib/utils'
  import HatchTrack from './HatchTrack.svelte'

  let { member, group, goal, today, userId }: {
    member: Member; group: GroupDetail; goal: GoalDetail | null; today: string; userId: string
  } = $props()
  const client = useQueryClient()
  const isMe = $derived(member.id === userId)
  const tally = $derived(goal ? crownTallies(goal, today).get(member.id) : undefined)
  const crowns = $derived(
    tally && goal
      ? [
          { id: 'overall', name: 'Top contributor', count: tally.overall },
          ...goal.components.map((c) => ({ id: c.id, name: c.name, count: tally.byComponent.get(c.id) ?? 0 })),
        ].filter((crown) => crown.count > 0)
      : [],
  )
  const earned = $derived(new Set(group.earnedTitles?.filter((t) => t.userId === member.id).map((t) => t.titleId)))
  const streak = $derived(currentStreak(goal?.entries.filter((e) => e.userId === member.id && e.amount > 0 && e.date >= goal.startDate && e.date <= goal.endDate).map((e) => e.date) ?? [], today))
  const next = $derived(TITLES.find((t) => !earned.has(t.id)))
  const equip = createMutation(() => ({
    mutationFn: (titleId: TitleId) => api(`/groups/${group.id}/title`, { method: 'PUT', body: { titleId } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['group'] })
      toast.success('Title updated')
    },
  }))
</script>

<div class="space-y-4 rounded-[14px] bg-secondary/60 px-4 py-3.5 text-sm">
  {#if goal}
    <section aria-label="Crowns">
      <h3 class="text-xs font-medium text-muted-foreground">Crowns</h3>
      {#if crowns.length}
        <ul class="mt-2 flex flex-col gap-2.5">
          {#each crowns as crown (crown.id)}
            <li class="flex items-center gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
                <CrownIcon class="size-3.5" />
              </span>
              <span class="min-w-0 flex-1 truncate font-medium">{crown.name}</span>
              <span class="tabular shrink-0 font-medium">{crown.count}<span class="sr-only"> {crown.count === 1 ? 'crown' : 'crowns'}</span></span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-1 text-muted-foreground">None yet.</p>
      {/if}
      <p class="mt-2 text-xs text-muted-foreground">Each day, the top contributor overall and in each activity earns a crown. Ties earn none.</p>
    </section>
  {/if}

  {#if group.achievementsEnabled}
    <section aria-label="Titles">
      <h3 class="text-xs font-medium text-muted-foreground">Titles{isMe && earned.size ? ' · tap one to show it' : ''}</h3>
      <ul class="mt-2 flex flex-wrap gap-1.5">
        {#each TITLES as title (title.id)}
          {@const unlocked = earned.has(title.id)}
          {@const shown = member.selectedTitle === title.id}
          <li>
            {#if isMe && unlocked}
              <button
                type="button"
                class={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors disabled:opacity-60',
                  shown ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
                )}
                aria-pressed={shown}
                disabled={equip.isPending}
                onclick={() => equip.mutate(title.id)}
              >
                {#if shown}<CheckIcon class="size-3" aria-hidden="true" />{/if}{title.name}
              </button>
            {:else}
              <span
                class={cn(
                  'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium',
                  unlocked ? (shown ? 'bg-primary text-primary-foreground' : 'bg-card') : 'border border-dashed border-input text-muted-foreground',
                )}
              >
                {title.name}{#if !unlocked}<span class="sr-only"> (locked)</span>{/if}
              </span>
            {/if}
          </li>
        {/each}
      </ul>
      {#if next}
        <div class="mt-3">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span><span class="text-muted-foreground">Next</span> <span class="font-medium">{next.name}</span></span>
            <span class="tabular text-muted-foreground">{Math.min(streak, next.days)} of {next.days} {next.days === 1 ? 'day' : 'days in a row'}</span>
          </div>
          <div class="mt-1.5"><HatchTrack value={Math.min(streak, next.days) / next.days} size="sm" label="Progress toward {next.name}" /></div>
        </div>
      {:else}
        <p class="mt-2 text-xs text-muted-foreground">Every title unlocked.</p>
      {/if}
    </section>
  {/if}
</div>
