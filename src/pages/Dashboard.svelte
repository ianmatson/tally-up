<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import type { Entry, GoalDetail, GroupDetail, User } from '$shared/api'
  import { daysBetween } from '$shared/dates'
  import CountUp from '$lib/components/CountUp.svelte'
  import HatchTrack from '$lib/components/HatchTrack.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import TallyGlyph from '$lib/components/TallyGlyph.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { dayWord, formatDayLabel, formatDays, formatNumber, formatPercent, formatPoints, roundDays } from '$lib/format'
  import { greeting } from '$lib/greeting'
  import { entriesInPeriod, goalProgress, memberScores, type Period, PERIOD_OPTIONS, rankBy } from '$lib/progress'

  const ACTIVITY_PAGE_SIZE = 6
  const LEADER_PREVIEW = 3
  const TILE_LABEL = 'text-[0.8rem]'
  const TILE_VALUE = 'mt-3 flex items-baseline gap-1.5 text-[2.6rem] leading-none font-semibold tracking-[-0.04em] sm:text-5xl'
  const TILE_UNIT = 'text-sm font-medium tracking-normal opacity-70'

  let { group, goal, now, user, canLog, onLog }: {
    group: GroupDetail
    goal: GoalDetail | null
    now: Date
    user: User
    canLog: boolean
    onLog: (entry?: Entry | null) => void
  } = $props()

  let activityScope = $state<'mine' | 'everyone'>('mine')
  let leaderPeriod = $state<Period>('all')
  let activityLimit = $state(ACTIVITY_PAGE_SIZE)

  const progress = $derived(goal ? goalProgress(goal, group.timezone, now) : null)
  const componentsById = $derived(new Map(goal?.components.map((c) => [c.id, c]) ?? []))
  const membersById = $derived(new Map(group.members.map((m) => [m.id, m])))
  const ranked = $derived(
    goal && progress
      ? rankBy(memberScores(group.members, goal.components, entriesInPeriod(goal, progress.today, leaderPeriod)), (s) => s.points)
      : [],
  )
  const daysToStart = $derived(goal && progress ? daysBetween(progress.today, goal.startDate) : 0)
  const leaderRows = $derived.by(() => {
    const top = ranked.slice(0, LEADER_PREVIEW)
    const me = ranked.find((r) => r.item.member.id === user.id)
    return me && !top.includes(me) ? [...top, me] : top
  })
  const activity = $derived(goal?.entries.filter((e) => activityScope === 'everyone' || e.userId === user.id) ?? [])
  const activityByDay = $derived(groupByDate(activity.slice(0, activityLimit)))
  const canEdit = (entry: Entry) => !!goal && !goal.archived && (entry.userId === user.id || group.isOwner)
  const leaderboardHref = $derived(`/g/${group.id}/leaderboard${goal?.archived ? `?goal=${goal.id}` : ''}`)

  function groupByDate(entries: Entry[]): [string, Entry[]][] {
    const days = new Map<string, Entry[]>()
    for (const entry of entries) days.set(entry.date, [...(days.get(entry.date) ?? []), entry])
    return [...days]
  }

  function subtitle(): string {
    if (!goal || !progress) return ''
    if (progress.phase === 'upcoming') return `${goal.name} · starts in ${formatDays(daysToStart)}`
    if (progress.phase === 'finished') return `${goal.name} · finished`
    return `${goal.name} · day ${progress.dayNumber} of ${progress.totalDays}`
  }
</script>

<div class="mx-auto max-w-xl lg:max-w-none">
  <div class="rise-in pt-4 pb-5">
    <h1 class="page-title">{greeting(user.name, now)}</h1>
    {#if goal}<p class="mt-0.5 text-sm text-muted-foreground">{subtitle()}</p>{/if}
  </div>

  {#if !goal || !progress}
    <section class="rise-in rounded-card bg-card p-6">
      <div class="mb-4 grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <TallyGlyph class="size-6" />
      </div>
      <h2 class="text-lg font-semibold tracking-tight">No goal yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {group.isOwner
          ? 'Set the first goal for your group: a time period and the things you want to do together.'
          : 'The group admin has not set a goal yet. You will see it here as soon as they do.'}
      </p>
      {#if group.isOwner}<Button href="/g/{group.id}/admin" class="mt-5">Create a goal</Button>{/if}
    </section>
  {:else}
    {#if goal.archived}
      <a href="/g/{group.id}" class="mb-3 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm">
        <span class="text-muted-foreground">You are looking at a past goal.</span>
        <span class="flex items-center gap-1 font-medium">Current goal <ChevronRightIcon class="size-4" /></span>
      </a>
    {/if}

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div class="flex flex-col gap-3 lg:gap-4">
        <div class="grid grid-cols-2 gap-3 lg:gap-4">
          <div class="rise-in rounded-card bg-card p-4 sm:p-5">
            <div class="{TILE_LABEL} text-muted-foreground">Complete</div>
            <div class={TILE_VALUE}>
              <CountUp value={Math.min(1, progress.overallFraction)} format={formatPercent} />
            </div>
          </div>
          <div class="rise-in rounded-card bg-highlight p-4 text-highlight-foreground [animation-delay:60ms] sm:p-5">
            {#if progress.complete}
              <div class="{TILE_LABEL} opacity-70">Goal</div>
              <div class={TILE_VALUE}>Done <TallyGlyph class="size-8 self-center" draw /></div>
            {:else if progress.phase === 'active'}
              <div class="{TILE_LABEL} opacity-70">{progress.daysAhead >= 0 ? 'Ahead of pace' : 'Behind pace'}</div>
              <div class={TILE_VALUE}>
                <CountUp value={roundDays(progress.daysAhead)} format={(n) => formatNumber(Math.round(n * 10) / 10)} />
                <span class={TILE_UNIT}>{dayWord(roundDays(progress.daysAhead))}</span>
              </div>
            {:else if progress.phase === 'upcoming'}
              <div class="{TILE_LABEL} opacity-70">Starts in</div>
              <div class={TILE_VALUE}>{daysToStart}<span class={TILE_UNIT}>{dayWord(daysToStart)}</span></div>
            {:else}
              <div class="{TILE_LABEL} opacity-70">Final result</div>
              <div class={TILE_VALUE}>{formatPercent(progress.overallFraction)}</div>
            {/if}
          </div>
        </div>

        <section class="rise-in rounded-card bg-card p-4 [animation-delay:120ms] sm:p-5" aria-label="Group goal">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="font-semibold tracking-tight">Group goal</h2>
            {#if progress.phase === 'active'}
              <span class="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <span class="size-1.5 rounded-full bg-current"></span>
                {progress.daysLeft === 1 ? 'Last day' : `${progress.daysLeft} days left`}
              </span>
            {/if}
          </div>
          <ul class="flex flex-col gap-4">
            {#each progress.components as item (item.component.id)}
              {@const done = item.total >= item.component.target}
              <li class="flex flex-col gap-2">
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="font-medium">{item.component.name}</span>
                  <span class="tabular text-muted-foreground">
                    {formatNumber(item.total)} / {formatNumber(item.component.target)} {item.component.unit}
                  </span>
                </div>
                <HatchTrack
                  value={item.fraction}
                  expected={progress.phase === 'active' ? progress.elapsedFraction : null}
                  label="{item.component.name} progress"
                />
                {#if done}
                  <span class="text-xs text-muted-foreground">Target reached · {formatPercent(item.fraction)}</span>
                {:else if progress.phase === 'active'}
                  <span class="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      <span class="tabular font-medium text-foreground">{formatNumber(Math.abs(item.aheadBy))}</span>
                      {item.aheadBy >= 0 ? 'ahead of' : 'behind'} pace
                    </span>
                    <span class="tabular">{formatNumber(item.neededPerDay)}/day to finish</span>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if progress.phase === 'active' && !progress.complete}
            <p class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span class="h-3 w-0.5 rounded-full bg-foreground"></span>
              Where the group should be today
            </p>
          {/if}
        </section>

        <section class="rise-in rounded-card bg-card p-4 [animation-delay:180ms] sm:p-5" aria-label="Leaderboard">
          <div class="mb-3 flex items-center justify-between gap-3">
            <a href={leaderboardHref} class="flex items-center gap-1 font-semibold tracking-tight">
              Leaderboard <ChevronRightIcon class="size-4 text-muted-foreground" />
            </a>
            <PillTabs bind:value={leaderPeriod} label="Leaderboard period" options={PERIOD_OPTIONS} />
          </div>
          <ol class="flex flex-col">
            {#each leaderRows as row (row.item.member.id)}
              {@const isMe = row.item.member.id === user.id}
              <li class="flex items-center gap-3 py-2">
                <span class="tabular w-4 text-center text-xs font-medium text-muted-foreground">{row.rank}</span>
                <UserAvatar name={row.item.member.name} avatarUrl={row.item.member.avatarUrl} size="sm" tone={isMe ? 'highlight' : 'muted'} />
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{isMe ? 'You' : row.item.member.name}</span>
                <span class="tabular text-sm font-semibold">{formatPoints(row.value)}</span>
              </li>
            {/each}
          </ol>
        </section>
      </div>

      <section class="rise-in rounded-card bg-card p-4 [animation-delay:220ms] sm:p-5" aria-label="Activity">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="font-semibold tracking-tight">Activity</h2>
            <PillTabs
              bind:value={activityScope}
              label="Activity filter"
              options={[{ value: 'mine', label: 'Mine' }, { value: 'everyone', label: 'Everyone' }]}
            />
          </div>

          {#if activity.length === 0}
            <p class="py-6 text-center text-sm text-muted-foreground">
              {activityScope === 'everyone' ? 'Nobody has logged anything yet.' : canLog && !goal.archived ? 'Nothing logged yet. Tap + to add your first tally.' : 'You did not log anything.'}
            </p>
          {/if}

          {#each activityByDay as [date, entries] (date)}
            <h3 class="mt-3 mb-1 text-xs font-medium text-muted-foreground">{formatDayLabel(date, progress.today)}</h3>
            <ul class="-mx-2 flex flex-col">
              {#each entries as entry (entry.id)}
                {@const component = componentsById.get(entry.componentId)}
                <li>
                  {#if canEdit(entry)}
                    <button
                      class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent active:bg-accent"
                      aria-label="Edit {formatNumber(entry.amount)} {component?.unit} {component?.name}"
                      onclick={() => onLog(entry)}
                    >
                      {@render entryRow(entry)}
                      <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  {:else}
                    <div class="flex items-center gap-3 px-2 py-2">{@render entryRow(entry)}</div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/each}

          {#if activity.length > activityLimit}
            <Button variant="secondary" class="mt-3 w-full" onclick={() => (activityLimit += ACTIVITY_PAGE_SIZE)}>Show more</Button>
          {/if}
        </section>
    </div>
  {/if}
</div>

{#snippet entryRow(entry: Entry)}
  {@const component = componentsById.get(entry.componentId)}
  {@const member = membersById.get(entry.userId)}
  {#if activityScope === 'everyone' && member}
    <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" tone={member.id === user.id ? 'highlight' : 'muted'} />
  {/if}
  <div class="min-w-0 flex-1">
    <div class="truncate text-sm">
      {#if activityScope === 'everyone'}
        <span class="font-medium">{member?.id === user.id ? 'You' : member?.name.split(' ')[0]}</span>
        <span class="text-muted-foreground">·</span>
      {/if}
      <span class="tabular font-semibold">{formatNumber(entry.amount)} {component?.unit}</span>
      <span class="text-muted-foreground">{component?.name}</span>
    </div>
    {#if entry.note}<div class="truncate text-xs text-muted-foreground">{entry.note}</div>{/if}
  </div>
{/snippet}
