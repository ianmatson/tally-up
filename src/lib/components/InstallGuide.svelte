<script lang="ts">
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { install, platform } from '$lib/install.svelte'
  import { Button } from '$lib/components/ui/button'

  const GUIDES = {
    ios: {
      title: 'iPhone and iPad (Safari)',
      steps: [
        'Open tally.ianm.app in Safari.',
        'Tap the Share button. On iOS 26, tap ••• next to the address bar first, then Share.',
        'Scroll down and tap Add to Home Screen.',
        'Keep Open as Web App on, then tap Add.',
      ],
    },
    android: {
      title: 'Android (Chrome)',
      steps: [
        'Open tally.ianm.app in Chrome.',
        'Tap the three-dot menu (⋮) in the top right corner.',
        'Tap Add to Home screen or Install app.',
        'Tap Install.',
      ],
    },
  } as const

  const shown = platform === 'other' ? [GUIDES.ios, GUIDES.android] : [GUIDES[platform]]
</script>

<div class="flex flex-col gap-4">
  {#if install.promptEvent}
    <Button class="w-fit" onclick={() => install.promptInstall()}><DownloadIcon /> Install Tally Up</Button>
  {/if}
  {#each shown as guide (guide.title)}
    <div>
      {#if shown.length > 1}<h3 class="mb-2 text-sm font-medium">{guide.title}</h3>{/if}
      <ol class="flex flex-col gap-2">
        {#each guide.steps as step, i (step)}
          <li class="flex gap-3 text-sm">
            <span class="tabular grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span>
            <span class="pt-0.5">{step}</span>
          </li>
        {/each}
      </ol>
    </div>
  {/each}
  <p class="text-xs text-muted-foreground">
    Then open Tally Up from the new icon. It opens full screen like an app.{platform === 'android' ? '' : ' On iPhone, you must open it this way to turn on notifications.'}
  </p>
</div>
