<script lang="ts">
  import TallyGlyph from './TallyGlyph.svelte'

  let { size = 'md', draw = false }: { size?: 'sm' | 'md' | 'lg'; draw?: boolean } = $props()

  const SIZES = { sm: 'size-7 [&_svg]:size-4', md: 'size-8 [&_svg]:size-[1.15rem]', lg: 'size-12 [&_svg]:size-7' }
</script>

<span class="grid shrink-0 place-items-center rounded-full bg-highlight-foreground text-highlight dark:bg-highlight dark:text-highlight-foreground {SIZES[size]}">
  <TallyGlyph {draw} />
</span>
