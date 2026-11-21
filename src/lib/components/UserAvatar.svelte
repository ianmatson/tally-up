<script lang="ts">
  import * as Avatar from '$lib/components/ui/avatar'
  import { initials } from '$lib/format'
  import { cn } from '$lib/utils'

  const TONES = {
    muted: 'bg-secondary text-muted-foreground',
    highlight: 'bg-highlight text-highlight-foreground',
    card: 'bg-card text-foreground',
  }

  let { name, avatarUrl, size = 'default', tone = 'muted' }: {
    name: string
    avatarUrl: string | null
    size?: 'sm' | 'default' | 'lg'
    tone?: keyof typeof TONES
  } = $props()
</script>

<Avatar.Root {size}>
  {#if avatarUrl}
    <Avatar.Image src={avatarUrl} alt="" referrerpolicy="no-referrer" />
  {/if}
  <Avatar.Fallback class={cn('text-[0.65rem] font-semibold', TONES[tone])}>
    {initials(name)}
  </Avatar.Fallback>
</Avatar.Root>
