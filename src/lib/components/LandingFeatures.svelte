<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
  import HatchTrack from './HatchTrack.svelte'

  const STEPS = [
    { title: 'Pick a goal', body: '10,000 pushups and 50 miles by New Year? Choose the activities, the targets, and the dates.' },
    { title: 'Invite your crew', body: 'Share one link. Friends join from any phone, with no app to install.' },
    { title: 'Log and race', body: 'Log a set in seconds, watch the group total climb, and fight for the daily crowns.' },
  ]

  const CROWNS = [
    { name: 'Top contributor', status: 'You lead · Cy 0.4% behind', value: '1.9%', mine: true },
    { name: 'Pushups', status: 'Ben leads · You 12 reps behind', value: '80 reps', mine: false },
    { name: 'Run', status: 'You lead · Ana 0.5 mi behind', value: '3 mi', mine: true },
  ]

  const REACTIONS = [
    { emoji: '🔥', count: 4, mine: true },
    { emoji: '💪', count: 2, mine: false },
    { emoji: '😂', count: 1, mine: false },
  ]

  const CHART = {
    line: 'M0,88 L30,80 L60,74 L90,63 L120,57 L150,45 L180,40',
    area: 'M0,88 L30,80 L60,74 L90,63 L120,57 L150,45 L180,40 L180,96 L0,96Z',
    projection: 'M180,40 L262,8',
  }
</script>

<section class="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="how-heading">
  <h2 id="how-heading" class="text-sm font-medium text-muted-foreground">How it works</h2>
  <ol class="mt-4 grid gap-3 sm:grid-cols-3">
    {#each STEPS as step, i (step.title)}
      <li class="flex gap-4 rounded-card bg-card p-5 sm:flex-col sm:gap-3 sm:p-6">
        <span class="tabular grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
        <div>
          <h3 class="font-semibold tracking-tight">{step.title}</h3>
          <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
      </li>
    {/each}
  </ol>
</section>

<section class="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="features-heading">
  <h2 id="features-heading" class="max-w-xl text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
    Everything a crew needs to keep showing up.
  </h2>
  <div class="mt-8 grid gap-3 md:grid-cols-2">
    <article class="feature">
      <div class="visual">
        <div class="mb-2 flex items-center justify-between text-xs">
          <span class="font-semibold">Group goal</span>
          <span class="rounded-full bg-highlight px-2 py-0.5 font-medium text-highlight-foreground">2.5 days ahead</span>
        </div>
        <svg viewBox="0 0 270 100" class="w-full" aria-hidden="true">
          <defs>
            <linearGradient id="landing-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--highlight)" stop-opacity="0.6" />
              <stop offset="100%" stop-color="var(--highlight)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2="270" y1="8" y2="8" stroke="var(--border)" />
          <line x1="0" x2="270" y1="96" y2="96" stroke="var(--border)" />
          <path d={CHART.area} fill="url(#landing-area)" />
          <path d={CHART.projection} stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="4 5" opacity="0.6" fill="none" />
          <path d={CHART.line} stroke="var(--foreground)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" fill="none" />
          <circle cx="180" cy="40" r="4.5" fill="var(--highlight)" stroke="var(--foreground)" stroke-width="2" />
        </svg>
      </div>
      <h3>Always know if you are on pace</h3>
      <p>One clear number shows how far ahead or behind the crew is, and the chart shows when you will finish at this pace.</p>
    </article>

    <article class="feature">
      <div class="visual divide-y py-1.5">
        {#each CROWNS as crown (crown.name)}
          <div class="flex items-center gap-2.5 py-2">
            <span class="grid size-6 shrink-0 place-items-center rounded-full {crown.mine ? 'bg-highlight text-highlight-foreground' : 'bg-secondary text-muted-foreground'}">
              <CrownIcon class="size-3" />
            </span>
            <span class="min-w-0 flex-1 leading-tight">
              <span class="block text-xs font-medium">{crown.name}</span>
              <span class="block truncate text-[0.7rem] text-muted-foreground">{crown.status}</span>
            </span>
            <span class="tabular text-xs font-semibold">{crown.value}</span>
          </div>
        {/each}
      </div>
      <h3>Win the day</h3>
      <p>Lead an activity when the day ends and the crown is yours. You can always see who is right behind you.</p>
    </article>

    <article class="feature">
      <div class="visual">
        <div class="flex items-start gap-2.5">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[0.6rem] font-semibold text-muted-foreground">CP</span>
          <div class="min-w-0 flex-1 text-xs leading-relaxed">
            <div><span class="font-semibold">Cy</span> <span class="text-muted-foreground">· 7:42 AM</span></div>
            <div><span class="font-semibold">40</span> <span class="text-muted-foreground">pushups,</span> <span class="font-semibold">3</span> <span class="text-muted-foreground">miles run, and</span> <span class="font-semibold">60</span> <span class="text-muted-foreground">situps</span></div>
            <div class="mt-1 italic text-muted-foreground">“Before work. Who is next?”</div>
            <div class="mt-2.5 flex flex-wrap gap-1.5">
              {#each REACTIONS as reaction (reaction.emoji)}
                <span class="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium {reaction.mine ? 'bg-highlight text-highlight-foreground' : 'bg-secondary'}">
                  {reaction.emoji}<span class="tabular">{reaction.count}</span>
                </span>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <h3>Cheer each other on</h3>
      <p>Every log goes to the group feed. React, comment, and add a photo to keep everyone moving.</p>
    </article>

    <article class="feature">
      <div class="visual flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs"><span class="font-medium">Run</span><span class="tabular text-muted-foreground">50 / 50 mi · done</span></div>
          <HatchTrack value={1} size="sm" label="Run" />
        </div>
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs"><span class="font-medium">Pushups</span><span class="tabular text-muted-foreground">6,120 / 10,000</span></div>
          <HatchTrack value={0.61} expected={0.7} size="sm" label="Pushups" />
        </div>
      </div>
      <h3>A leaderboard that is fair</h3>
      <p>Each activity is a set share of the goal, and logs past a target do not count. So everyone helps where the crew needs it most.</p>
    </article>
  </div>
</section>

<style>
  .feature {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-card);
    background: var(--card);
    padding: 1.25rem;

    @media (min-width: 40rem) {
      padding: 1.5rem;
    }

    & h3 {
      margin-top: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.025em;
    }

    & p {
      margin-top: 0.375rem;
      font-size: 0.875rem;
      line-height: 1.625;
      color: var(--muted-foreground);
    }
  }

  .visual {
    border-radius: 18px;
    background: var(--background);
    padding: 0.875rem 1rem;
  }
</style>
