<script lang="ts">
  import { HOLIDAY_FLAIR } from '$lib/holiday/flag'
  import SantaHat from '$lib/holiday/SantaHat.svelte'
  import TallyGlyph from './TallyGlyph.svelte'

  let { size = 'md', draw = false }: { size?: 'sm' | 'md' | 'lg'; draw?: boolean } = $props()

  const SIZES = {
    sm: { mark: 'size-7', glyph: 'size-4' },
    md: { mark: 'size-8', glyph: 'size-[1.15rem]' },
    lg: { mark: 'size-12', glyph: 'size-7' },
  }
</script>

<span class="relative grid shrink-0 place-items-center rounded-full bg-highlight-foreground text-highlight dark:bg-highlight dark:text-highlight-foreground {SIZES[size].mark}">
  <TallyGlyph class={SIZES[size].glyph} {draw} />
  {#if HOLIDAY_FLAIR}<SantaHat />{/if}
</span>
