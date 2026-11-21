<script lang="ts">
  import dataSource from 'emoji-picker-element-data/en/emojibase/data.json?url'
  import { mode } from 'mode-watcher'

  let { onPick }: { onPick: (emoji: string) => void } = $props()

  let host = $state<HTMLDivElement | null>(null)

  $effect(() => {
    if (!host) return
    const target = host
    let picker: HTMLElement | undefined
    let cancelled = false
    import('emoji-picker-element/picker').then(({ default: Picker }) => {
      if (cancelled) return
      const instance = new Picker({ dataSource })
      instance.classList.add(mode.current === 'dark' ? 'dark' : 'light')
      instance.addEventListener('emoji-click', (event) => onPick(event.detail.unicode ?? ''))
      target.append(instance)
      picker = instance
    })
    return () => {
      cancelled = true
      picker?.remove()
    }
  })
</script>

<div bind:this={host} class="emoji-picker-host"></div>
