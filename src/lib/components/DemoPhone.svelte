<script lang="ts">
  import BrandMark from './BrandMark.svelte'
  import CountUp from './CountUp.svelte'
  import HatchTrack from './HatchTrack.svelte'
  import { formatPercent } from '$lib/format'

  const COMPONENTS = [
    { name: 'Pushups', total: '3,409 / 10,000', value: 0.34 },
    { name: 'Situps', total: '2,362 / 10,000', value: 0.24 },
    { name: 'Run', total: '80.4 / 50 mi', value: 1.6 },
  ]
  const LEADERS = [
    { initials: 'BO', name: 'Ben', score: '18.9%', me: false },
    { initials: 'CP', name: 'Cy', score: '13%', me: false },
    { initials: 'AT', name: 'You', score: '12.5%', me: true },
  ]
  const PACE = 0.68
</script>

<div class="w-[300px] shrink-0 rounded-[44px] bg-[#0e0e0e] p-2.5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.35)] ring-1 ring-black/10 dark:ring-white/10" aria-hidden="true">
  <div class="flex h-[600px] flex-col gap-3 overflow-hidden rounded-[36px] bg-background px-4 pt-5 pb-4">
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-2 text-sm font-semibold"><BrandMark size="sm" /> Tally Up</span>
      <span class="rounded-full bg-card px-3 py-1 text-xs font-medium">Iron Friends</span>
    </div>
    <div class="mt-1">
      <div class="text-xl font-semibold tracking-tight">Morning, Ana</div>
      <div class="text-xs text-muted-foreground">November grind · day 21 of 30</div>
    </div>
    <div class="grid grid-cols-2 gap-2.5">
      <div class="rounded-[18px] bg-card p-3">
        <div class="text-[0.7rem] text-muted-foreground">Complete</div>
        <div class="mt-2 text-3xl font-semibold tracking-[-0.04em]"><CountUp value={0.53} format={formatPercent} /></div>
      </div>
      <div class="rounded-[18px] bg-highlight p-3 text-highlight-foreground">
        <div class="text-[0.7rem] opacity-70">Behind pace</div>
        <div class="mt-2 flex items-baseline gap-1 text-3xl font-semibold tracking-[-0.04em]">
          <CountUp value={4.5} format={(n) => n.toFixed(1)} /><span class="text-xs font-medium tracking-normal opacity-70">days</span>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-3 rounded-[18px] bg-card p-3.5">
      <div class="flex items-center justify-between text-sm font-semibold">Group goal <span class="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">9 days left</span></div>
      {#each COMPONENTS as c (c.name)}
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs"><span class="font-medium">{c.name}</span><span class="tabular text-muted-foreground">{c.total}</span></div>
          <HatchTrack value={c.value} expected={PACE} size="sm" label={c.name} />
        </div>
      {/each}
    </div>
    <div class="flex flex-col gap-2 rounded-[18px] bg-card p-3.5">
      <div class="flex items-center justify-between text-sm font-semibold">
        Leaderboard
        <span class="flex gap-0.5 rounded-full bg-secondary p-0.5 text-[0.65rem] font-medium"><span class="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">All</span><span class="px-2 py-0.5 text-muted-foreground">7 days</span></span>
      </div>
      {#each LEADERS as l (l.name)}
        <div class="flex items-center gap-2 text-xs">
          <span class="grid size-5 place-items-center rounded-full text-[0.55rem] font-semibold {l.me ? 'bg-highlight text-highlight-foreground' : 'bg-secondary text-muted-foreground'}">{l.initials}</span>
          <span class="flex-1 font-medium">{l.name}</span><span class="tabular font-semibold">{l.score}</span>
        </div>
      {/each}
    </div>
    <div class="mt-auto grid h-12 grid-cols-5 items-center rounded-full bg-secondary p-1 ring-1 ring-border/60 text-[0.7rem] font-medium text-muted-foreground shadow-[0_6px_20px_rgb(0_0_0/0.08)]">
      <span class="grid h-full place-items-center rounded-full bg-primary text-primary-foreground">Home</span>
      <span class="text-center">Feed</span>
      <span class="mx-auto grid size-9 place-items-center rounded-full bg-highlight text-lg text-highlight-foreground">+</span>
      <span class="text-center">Leaders</span>
      <span class="text-center">History</span>
    </div>
  </div>
</div>
