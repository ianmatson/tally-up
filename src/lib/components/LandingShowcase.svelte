<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
  import DemoPhone from './DemoPhone.svelte'

  const REACTIONS = [
    { emoji: '🔥', count: 3, mine: true },
    { emoji: '💪', count: 2, mine: false },
  ]
</script>

<div class="relative mx-auto w-full max-w-[460px] py-6 lg:max-w-[540px]" aria-hidden="true">
  <div class="glow absolute top-1/2 left-1/2 aspect-square w-[min(380px,100%)] -translate-1/2 rounded-full bg-highlight blur-3xl"></div>
  <div class="hatched absolute top-10 right-0 size-40 rounded-full opacity-70 [mask-image:radial-gradient(circle,black,transparent_70%)]"></div>

  <div class="relative flex justify-center">
    <DemoPhone />
  </div>

  <div class="rise-in absolute top-[41%] left-0 w-[212px] [animation-delay:500ms]">
    <div class="float rounded-[20px] bg-card p-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.28)] ring-1 ring-black/5 dark:ring-white/10">
      <div class="flex items-center gap-2">
        <span class="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[0.6rem] font-semibold text-muted-foreground">BO</span>
        <div class="min-w-0 text-xs leading-snug">
          <span class="font-semibold">Ben</span> logged <span class="font-semibold">50</span> <span class="text-muted-foreground">pushups</span>
          <div class="text-[0.65rem] text-muted-foreground">2m ago</div>
        </div>
      </div>
      <div class="mt-2.5 flex gap-1.5">
        {#each REACTIONS as reaction (reaction.emoji)}
          <span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {reaction.mine ? 'bg-highlight text-highlight-foreground' : 'bg-secondary'}">
            {reaction.emoji}<span class="tabular">{reaction.count}</span>
          </span>
        {/each}
      </div>
    </div>
  </div>

  <div class="rise-in absolute right-0 bottom-[19%] w-[220px] [animation-delay:700ms]">
    <div class="float float-late flex items-center gap-2.5 rounded-[20px] bg-card p-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.28)] ring-1 ring-black/5 dark:ring-white/10">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <CrownIcon class="size-4" />
      </span>
      <div class="min-w-0 leading-tight">
        <div class="text-xs font-semibold">Pushups crown</div>
        <div class="mt-0.5 text-[0.7rem] text-muted-foreground">You lead · Ben 31 reps behind</div>
      </div>
    </div>
  </div>
</div>

<style>
  .glow {
    opacity: 0.45;
  }

  :global(.dark) .glow {
    opacity: 0.14;
  }

  .float {
    animation: float 6s ease-in-out infinite alternate;
  }

  .float-late {
    animation-delay: -3s;
  }

  @keyframes float {
    from {
      transform: translateY(-5px);
    }
    to {
      transform: translateY(5px);
    }
  }
</style>
