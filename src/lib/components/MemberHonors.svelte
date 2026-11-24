<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { toast } from 'svelte-sonner'
  import CheckIcon from '@lucide/svelte/icons/check'
  import CrownIcon from '@lucide/svelte/icons/crown'
  import type { GoalDetail, GroupDetail, Member } from '$shared/api'
  import { CROWNS, TITLES, currentStreak, formatCrownTotal, type TitleId } from '$shared/achievements'
  import { api } from '$lib/api'
  import { cn } from '$lib/utils'
  import HatchTrack from './HatchTrack.svelte'

  let { member, group, goal, today, userId }: {
    member: Member; group: GroupDetail; goal: GoalDetail | null; today: string; userId: string
  } = $props()
  const client = useQueryClient()
  const isMe = $derived(member.id === userId)
  const crowns = $derived(goal?.crowns?.filter((c) => c.userId === member.id) ?? [])
  const earned = $derived(new Set(group.earnedTitles?.filter((t) => t.userId === member.id).map((t) => t.titleId)))
  const streak = $derived(currentStreak(goal?.entries.filter((e) => e.userId === member.id && e.amount > 0 && e.date >= goal.startDate && e.date <= goal.endDate).map((e) => e.date) ?? [], today))
  const next = $derived(TITLES.find((t) => !earned.has(t.id)))
  const formerCrowns = $derived(goal?.crownRecords?.filter((r) => r.userId === member.id && !crowns.some((c) => c.category === r.category)) ?? [])
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
          {#each crowns as crown (crown.category)}
            <li class="flex items-center gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground" aria-hidden="true">
                <CrownIcon class="size-3.5" />
              </span>
              <div class="min-w-0 flex-1 leading-tight">
                <div class="truncate font-medium">{CROWNS[crown.category].name}</div>
                <div class="truncate text-xs text-muted-foreground">{CROWNS[crown.category].label}</div>
              </div>
              <span class="tabular shrink-0 font-medium">{formatCrownTotal(crown.category, crown.total)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-1 text-muted-foreground">None yet. Lead a category in this goal to take one.</p>
      {/if}
      {#if formerCrowns.length}
        <p class="mt-2 text-xs text-muted-foreground">Previously held {formerCrowns.map((r) => CROWNS[r.category].name).join(', ')}</p>
      {/if}
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
