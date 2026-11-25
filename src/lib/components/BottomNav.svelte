<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { cn } from '$lib/utils'

  type NavItem = { id: string; label: string; href: string }

  let { items, active, canLog, onLog }: { items: NavItem[]; active: string; canLog: boolean; onLog: () => void } = $props()

  const LOG_SLOT = 2
  const slots = $derived([...items.slice(0, LOG_SLOT), null, ...items.slice(LOG_SLOT)])
  const activeIndex = $derived(slots.findIndex((slot) => slot?.id === active))
</script>

<nav class="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Group sections">
  <div
    class="relative mx-auto grid h-14 max-w-md items-center rounded-full bg-gradient-to-b from-nav/55 to-nav/80 p-1.5 backdrop-blur-md backdrop-saturate-[1.8] shadow-[inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-1px_0_rgb(0_0_0/0.05),0_10px_30px_rgb(0_0_0/0.14)] ring-1 ring-black/5 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_10px_30px_rgb(0_0_0/0.55)] dark:ring-white/10"
    style="grid-template-columns: repeat({slots.length}, minmax(0, 1fr))"
  >
    {#if activeIndex >= 0}
      <div
        class="absolute inset-y-1.5 left-1.5 rounded-full bg-primary transition-transform duration-300 ease-out-quint"
        style="width: calc((100% - 0.75rem) / {slots.length}); transform: translateX({activeIndex * 100}%)"
        aria-hidden="true"
      ></div>
    {/if}
    {#each slots as slot, i (slot?.id ?? 'log')}
      {#if slot}
        <a
          href={slot.href}
          class={cn(
            'relative z-10 grid h-full place-items-center rounded-full text-[0.8rem] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
            i === activeIndex ? 'text-primary-foreground' : 'text-foreground/70 hover:text-foreground',
          )}
          aria-current={i === activeIndex ? 'page' : undefined}
        >
          {slot.label}
        </a>
      {:else}
        <div class="relative z-10 grid place-items-center">
          <button
            class="grid size-11 place-items-center rounded-full bg-highlight text-highlight-foreground shadow-sm ring-1 ring-highlight-foreground/20 transition-transform duration-200 ease-spring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-90 disabled:opacity-40"
            aria-label="Log progress"
            disabled={!canLog}
            onclick={onLog}
          >
            <PlusIcon class="size-5" strokeWidth={2.5} />
          </button>
        </div>
      {/if}
    {/each}
  </div>
</nav>
