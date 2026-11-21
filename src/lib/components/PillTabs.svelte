<script lang="ts" generics="T extends string">
  import { cn } from '$lib/utils'

  let { value = $bindable(), options, label, size = 'sm' }: {
    value: T
    options: { value: T; label: string }[]
    label: string
    size?: 'sm' | 'md'
  } = $props()
</script>

<div class="inline-flex shrink-0 gap-0.5 rounded-full bg-secondary p-0.5" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      aria-pressed={value === option.value}
      class={cn(
        'shrink-0 rounded-full font-medium whitespace-nowrap transition-colors duration-150',
        size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
        value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
