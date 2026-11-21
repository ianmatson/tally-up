<script lang="ts" generics="T extends string">
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import * as Command from '$lib/components/ui/command'
  import * as Popover from '$lib/components/ui/popover'
  import { cn } from '$lib/utils'

  let { value = $bindable(), options, label, placeholder, class: className }: {
    value: T
    options: { value: T; label: string; hint?: string }[]
    label: string
    placeholder: string
    class?: string
  } = $props()

  let open = $state(false)
  const selected = $derived(options.find((o) => o.value === value))

  function skipKeyboardOnTouch(event: Event) {
    if (window.matchMedia('(pointer: coarse)').matches) event.preventDefault()
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={cn(
      'flex h-12 w-full items-center gap-2 rounded-2xl bg-secondary px-4 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      className,
    )}
    aria-label="{label}: {selected?.label ?? ''}"
  >
    <span class="min-w-0 flex-1 truncate font-medium">{selected?.label}</span>
    {#if selected?.hint}<span class="shrink-0 text-xs text-muted-foreground">{selected.hint}</span>{/if}
    <ChevronsUpDownIcon class="size-4 shrink-0 text-muted-foreground" />
  </Popover.Trigger>
  <Popover.Content align="start" class="w-(--bits-popover-anchor-width) min-w-64 rounded-2xl p-1" onOpenAutoFocus={skipKeyboardOnTouch}>
    <Command.Root>
      <Command.Input {placeholder} />
      <Command.List class="max-h-64">
        <Command.Empty>Nothing matches.</Command.Empty>
        {#each options as option (option.value)}
          <Command.Item
            value={option.value}
            keywords={[option.label]}
            data-checked={option.value === value}
            class="rounded-lg py-2"
            onSelect={() => {
              value = option.value
              open = false
            }}
          >
            <span class="min-w-0 flex-1 truncate">{option.label}</span>
            {#if option.hint}<span class="text-xs text-muted-foreground">{option.hint}</span>{/if}
          </Command.Item>
        {/each}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
