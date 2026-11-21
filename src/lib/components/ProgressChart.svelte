<script lang="ts" module>
  export type ChartSeries = { id: string; name: string; color: string; values: number[] }
</script>

<script lang="ts">
  import { formatDate } from '$lib/format'

  let { days, series, reference, format, label, focusId, highlightId }: {
    days: string[]
    series: ChartSeries[]
    reference: number[] | null
    format: (n: number) => string
    label: string
    focusId: string | null
    highlightId: string
  } = $props()

  const HEIGHT = 232
  const PAD = { top: 14, right: 14, bottom: 26, left: 44 }
  const LABEL_GUTTER = 64
  const MAX_DIRECT_LABELS = 4
  const MIN_LABEL_GAP = 13
  const Y_TICKS = 4
  const TOOLTIP_ROWS = 6

  let width = $state(0)
  let hover = $state<number | null>(null)
  let tooltipWidth = $state(0)

  const directLabels = $derived(series.length <= MAX_DIRECT_LABELS)
  const right = $derived(PAD.right + (directLabels ? LABEL_GUTTER : 0))
  const plotWidth = $derived(Math.max(0, width - PAD.left - right))
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const last = $derived(days.length - 1)

  const yMax = $derived(niceCeiling(Math.max(1, ...series.map((s) => s.values[last]), reference?.[last] ?? 0)))
  const yTicks = $derived(Array.from({ length: Y_TICKS + 1 }, (_, i) => (yMax / Y_TICKS) * i))
  const xTicks = $derived([...new Set([0, Math.round(last / 2), last])])

  const x = (i: number) => PAD.left + (last === 0 ? plotWidth / 2 : (i / last) * plotWidth)
  const y = (v: number) => PAD.top + plotHeight - (v / yMax) * plotHeight
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')

  const ordered = $derived([...series].sort((a, b) => Number(a.id === focusId) - Number(b.id === focusId)))

  const endLabels = $derived.by(() => {
    if (!directLabels) return []
    const placed: { id: string; name: string; y: number }[] = []
    const priority = (s: ChartSeries) => (s.id === highlightId ? -Infinity : -s.values[last])
    for (const s of [...series].sort((a, b) => priority(a) - priority(b))) {
      const labelY = y(s.values[last])
      if (placed.every((p) => Math.abs(p.y - labelY) >= MIN_LABEL_GAP)) placed.push({ id: s.id, name: s.name, y: labelY })
    }
    return placed
  })

  const index = $derived(Math.min(hover ?? last, last))
  const rankedAt = $derived(series.toSorted((a, b) => b.values[index] - a.values[index]))
  const tooltipRows = $derived.by(() => {
    if (rankedAt.length <= TOOLTIP_ROWS) return rankedAt
    const top = rankedAt.slice(0, TOOLTIP_ROWS - 1)
    const highlight = rankedAt.find((s) => s.id === (focusId ?? highlightId))
    return highlight && !top.includes(highlight) ? [...top, highlight] : rankedAt.slice(0, TOOLTIP_ROWS)
  })

  const ariaValueText = $derived(`${formatDate(days[index])}: ${rankedAt.map((s) => `${s.name} ${format(s.values[index])}`).join(', ')}`)

  function niceCeiling(value: number): number {
    const magnitude = 10 ** Math.floor(Math.log10(value))
    return [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value)! * magnitude
  }

  function track(event: PointerEvent & { currentTarget: SVGSVGElement }) {
    const ratio = (event.clientX - event.currentTarget.getBoundingClientRect().left - PAD.left) / plotWidth
    hover = last === 0 ? 0 : Math.min(last, Math.max(0, Math.round(ratio * last)))
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowLeft' ? -1 : 1
    hover = Math.min(last, Math.max(0, index + step))
  }
</script>

<div class="relative" bind:clientWidth={width}>
  {#if width > 0}
    <svg
      width={width}
      height={HEIGHT}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={index}
      aria-valuetext={ariaValueText}
      tabindex="0"
      class="block touch-pan-y rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onpointermove={track}
      onpointerdown={track}
      onpointerleave={(e) => e.pointerType === 'mouse' && (hover = null)}
      onkeydown={onKeydown}
      onblur={() => (hover = null)}
    >
      {#each yTicks as tick (tick)}
        <line x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--border)" stroke-width="1" />
        <text x={PAD.left - 8} y={y(tick)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px] tabular">{format(tick)}</text>
      {/each}
      {#each xTicks as i (i)}
        <text
          x={x(i)}
          y={HEIGHT - 6}
          text-anchor={i === 0 && last > 0 ? 'start' : i === last && last > 0 ? 'end' : 'middle'}
          class="fill-muted-foreground text-[11px]">{formatDate(days[i])}</text
        >
      {/each}

      {#if reference}
        <path d={path(reference)} fill="none" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" />
      {/if}

      {#each ordered as s (s.id)}
        {@const dimmed = focusId !== null && s.id !== focusId}
        {@const strong = s.id === focusId || (focusId === null && s.id === highlightId)}
        <path
          d={path(s.values)}
          fill="none"
          stroke={s.color}
          stroke-width={strong ? 3 : 2}
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity={dimmed ? 0.2 : 1}
          class="transition-opacity duration-200"
        />
        <circle cx={x(last)} cy={y(s.values[last])} r="4" fill={s.color} stroke="var(--card)" stroke-width="2" opacity={dimmed ? 0.2 : 1} />
      {/each}

      {#each endLabels as l (l.id)}
        <text x={x(last) + 10} y={l.y} dy="0.32em" class="fill-foreground text-[12px] font-medium">{l.name}</text>
      {/each}

      {#if hover !== null}
        <line x1={x(index)} x2={x(index)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--foreground)" stroke-width="1" opacity="0.35" />
        {#each series as s (s.id)}
          <circle cx={x(index)} cy={y(s.values[index])} r="4" fill={s.color} stroke="var(--card)" stroke-width="2" />
        {/each}
      {/if}
    </svg>

    {#if hover !== null}
      {@const gap = 12}
      {@const preferred = x(index) > width / 2 ? x(index) - tooltipWidth - gap : x(index) + gap}
      <div
        class="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl bg-popover px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.14)] ring-1 ring-border"
        style="left: {Math.min(Math.max(PAD.left + 4, preferred), width - tooltipWidth)}px"
        bind:clientWidth={tooltipWidth}
        role="status"
      >
        <div class="mb-1 text-xs text-muted-foreground">{formatDate(days[index])}</div>
        {#each tooltipRows as row (row.id)}
          <div class="flex items-center gap-2 py-0.5">
            <span class="h-0.5 w-3 shrink-0 rounded-full" style="background: {row.color}"></span>
            <span class="tabular font-semibold">{format(row.values[index])}</span>
            <span class="truncate text-muted-foreground">{row.name}</span>
          </div>
        {/each}
        {#if rankedAt.length > tooltipRows.length}
          <div class="pt-0.5 text-xs text-muted-foreground">and {rankedAt.length - tooltipRows.length} more</div>
        {/if}
        {#if reference}
          <div class="mt-1 flex items-center gap-2 border-t pt-1 text-xs text-muted-foreground">
            <span class="h-0 w-3 shrink-0 border-t-[1.5px] border-dashed border-muted-foreground"></span>
            <span class="tabular">{format(reference[index])}</span> even share
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
