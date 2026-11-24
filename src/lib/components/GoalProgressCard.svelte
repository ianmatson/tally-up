<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import type { GoalDetail } from '$shared/api'
  import { addDays } from '$shared/dates'
  import { formatAmount } from '$shared/units'
  import CountUp from '$lib/components/CountUp.svelte'
  import HatchTrack from '$lib/components/HatchTrack.svelte'
  import TallyGlyph from '$lib/components/TallyGlyph.svelte'
  import { dayWord, formatDate, formatNumber, formatPercent, formatShare, roundDays } from '$lib/format'
  import { componentShares, dailyGroupProgress, type GoalProgress } from '$lib/progress'
  import { cn } from '$lib/utils'

  let { goal, progress, memberCount, daysToStart }: {
    goal: GoalDetail
    progress: GoalProgress
    memberCount: number
    daysToStart: number
  } = $props()

  const COMPACT_HEIGHT = 176
  const WIDE_HEIGHT = 224
  const WIDE_FROM = 560
  const PAD = { top: 10, right: 6, bottom: 24, left: 40 }
  const Y_TICKS = [0, 0.5, 1]
  let width = $state(0)
  let hover = $state<number | null>(null)
  let showBreakdown = $state(false)

  const values = $derived(dailyGroupProgress(goal, progress.today))
  const shares = $derived(componentShares(goal.components))
  const overall = $derived(Math.min(1, progress.overallFraction))
  const height = $derived(width >= WIDE_FROM ? WIDE_HEIGHT : COMPACT_HEIGHT)
  const plotHeight = $derived(height - PAD.top - PAD.bottom)
  const plotWidth = $derived(Math.max(0, width - PAD.left - PAD.right))
  const lastIndex = $derived(values.length - 1)
  const index = $derived(hover ?? lastIndex)
  const pace = (i: number) => (i + 1) / progress.totalDays

  const x = (day: number) => PAD.left + (day / progress.totalDays) * plotWidth
  const y = (fraction: number) => PAD.top + plotHeight - Math.min(1, fraction) * plotHeight
  const points = $derived([[x(0), y(0)], ...values.map((v, i) => [x(i + 1), y(v)])])
  const line = $derived(points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(''))
  const area = $derived(values.length ? `${line}L${x(values.length).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z` : '')

  const status = $derived.by(() => {
    if (progress.complete) return { label: 'Goal complete', ahead: true }
    if (progress.phase === 'upcoming') return { label: `Starts in ${daysToStart} ${dayWord(daysToStart)}`, ahead: true }
    if (progress.phase === 'finished') return { label: 'Goal ended', ahead: false }
    const days = roundDays(progress.daysAhead)
    return { label: `${formatNumber(days)} ${dayWord(days)} ${progress.daysAhead >= 0 ? 'ahead of' : 'behind'} pace`, ahead: progress.daysAhead >= 0 }
  })

  function track(event: PointerEvent & { currentTarget: SVGSVGElement }) {
    if (lastIndex < 0) return
    const ratio = (event.clientX - event.currentTarget.getBoundingClientRect().left - PAD.left) / plotWidth
    hover = Math.min(lastIndex, Math.max(0, Math.round(ratio * progress.totalDays) - 1))
  }

  function onKeydown(event: KeyboardEvent) {
    if (lastIndex < 0 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    hover = Math.min(lastIndex, Math.max(0, index + (event.key === 'ArrowLeft' ? -1 : 1)))
  }
</script>

<section class="rise-in rounded-card bg-card p-4 sm:p-5" aria-label="Group goal">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 class="text-[0.8rem] text-muted-foreground">Group goal</h2>
      <div class="mt-1 flex items-center gap-2 text-[2.6rem] leading-none font-semibold tracking-[-0.04em] sm:text-5xl">
        <CountUp value={overall} format={formatPercent} />
        {#if progress.complete}<TallyGlyph class="size-8" draw />{/if}
      </div>
    </div>
    {#if progress.phase === 'active'}
      <span class="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <span class="size-1.5 rounded-full bg-current"></span>
        {progress.daysLeft === 1 ? 'Last day' : `${progress.daysLeft} days left`}
      </span>
    {/if}
  </div>
  <p class="mt-2.5">
    <span class={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', status.ahead ? 'bg-highlight text-highlight-foreground' : 'bg-secondary')}>
      {status.label}
    </span>
  </p>

  <div class="relative mt-4" bind:clientWidth={width}>
    {#if width > 0}
      <svg
        {width}
        {height}
        role="slider"
        aria-label="Group progress by day"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, lastIndex)}
        aria-valuenow={Math.max(0, index)}
        aria-valuetext={lastIndex < 0 ? 'No progress yet' : `${formatDate(addDays(goal.startDate, index))}: ${formatShare(values[index])} complete, pace ${formatShare(pace(index))}`}
        tabindex="0"
        class="block touch-pan-y overflow-visible rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onpointermove={track}
        onpointerdown={track}
        onpointerleave={(e) => e.pointerType === 'mouse' && (hover = null)}
        onkeydown={onKeydown}
        onblur={() => (hover = null)}
      >
        <defs>
          <linearGradient id="goal-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--highlight)" stop-opacity="0.55" />
            <stop offset="100%" stop-color="var(--highlight)" stop-opacity="0" />
          </linearGradient>
        </defs>

        {#each Y_TICKS as tick (tick)}
          <line x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--border)" stroke-width="1" />
          <text x={PAD.left - 8} y={y(tick)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px] tabular">{formatPercent(tick)}</text>
        {/each}
        <text x={PAD.left} y={height - 6} class="fill-muted-foreground text-[11px]">{formatDate(goal.startDate)}</text>
        <text x={PAD.left + plotWidth} y={height - 6} text-anchor="end" class="fill-muted-foreground text-[11px]">{formatDate(goal.endDate)}</text>

        <line x1={x(0)} y1={y(0)} x2={x(progress.totalDays)} y2={y(1)} stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="4 5" opacity="0.6" />

        {#if values.length}
          <path d={area} fill="url(#goal-area)" class="goal-area" />
          <path d={line} pathLength="1" fill="none" stroke="var(--foreground)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="goal-line" />
          {#if hover === null}
            <circle cx={x(values.length)} cy={y(values[lastIndex])} r="9" fill="var(--highlight)" class="goal-pulse" />
          {/if}
          <circle cx={x(index + 1)} cy={y(values[index])} r="5" fill="var(--highlight)" stroke="var(--foreground)" stroke-width="2" />
        {/if}

        {#if hover !== null}
          <line x1={x(index + 1)} x2={x(index + 1)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--foreground)" stroke-width="1" opacity="0.3" />
          <circle cx={x(index + 1)} cy={y(pace(index))} r="3" fill="var(--muted-foreground)" />
        {/if}
      </svg>

      {#if hover !== null}
        <div
          class="pointer-events-none absolute top-0 z-10 rounded-xl bg-popover px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.14)] ring-1 ring-border"
          style="{x(index + 1) > width / 2 ? 'right' : 'left'}: {x(index + 1) > width / 2 ? width - x(index + 1) + 12 : x(index + 1) + 12}px"
          role="status"
        >
          <div class="text-xs text-muted-foreground">{formatDate(addDays(goal.startDate, index))}</div>
          <div class="tabular font-semibold">{formatShare(values[index])} complete</div>
          <div class="tabular text-xs text-muted-foreground">Pace {formatShare(pace(index))}</div>
        </div>
      {/if}
    {/if}
  </div>
  <p class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
    <span class="w-3 border-t-[1.5px] border-dashed border-muted-foreground"></span>
    Pace to finish on time
  </p>

  <button
    type="button"
    class="-mx-2 mt-3 flex w-[calc(100%+1rem)] items-center justify-between rounded-xl px-2 py-2 text-sm font-medium transition-colors hover:bg-accent"
    aria-expanded={showBreakdown}
    onclick={() => (showBreakdown = !showBreakdown)}
  >
    Breakdown by activity
    <ChevronDownIcon class={cn('size-4 text-muted-foreground transition-transform duration-200', showBreakdown && 'rotate-180')} />
  </button>
  {#if showBreakdown}
    <ul class="mt-2 flex flex-col gap-4">
      {#each progress.components as item (item.component.id)}
        {@const done = item.total >= item.component.target}
        <li class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3 text-sm">
            <span><span class="font-medium">{item.component.name}</span> <span class="text-xs text-muted-foreground">· {formatShare(shares.get(item.component.id) ?? 0)} of goal</span></span>
            <span class="tabular text-muted-foreground">{formatNumber(item.total)} / {formatAmount(item.component.target, item.component.unit)}</span>
          </div>
          <HatchTrack value={item.fraction} expected={progress.phase === 'active' ? progress.elapsedFraction : null} label="{item.component.name} progress" />
          {#if done}
            <span class="text-xs text-muted-foreground">Target reached · {formatPercent(item.fraction)}</span>
          {:else if progress.phase === 'active'}
            <span class="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>
                <span class="tabular font-medium text-foreground">{formatAmount(Math.abs(item.aheadBy), item.component.unit)}</span>
                {item.aheadBy >= 0 ? 'ahead of' : 'behind'} pace
              </span>
              <span class="tabular">{formatNumber(item.neededPerDay / memberCount)}/day{memberCount > 1 ? ' each' : ''} to finish</span>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .goal-line {
    stroke-dasharray: 1;
    animation: draw-stroke 1100ms var(--ease-out-quint) both;
    --stroke-length: 1;
  }

  .goal-area {
    animation: area-in 900ms var(--ease-out-quint) 200ms both;
  }

  .goal-pulse {
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 2.4s var(--ease-out-quint) 1.1s infinite;
  }

  @keyframes area-in {
    from {
      opacity: 0;
    }
  }

  @keyframes pulse {
    0% {
      opacity: 0.7;
      transform: scale(0.4);
    }
    100% {
      opacity: 0;
      transform: scale(1.6);
    }
  }
</style>
