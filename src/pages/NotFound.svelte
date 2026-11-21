<script lang="ts">
  import TallyGlyph from '$lib/components/TallyGlyph.svelte'
  import { Button } from '$lib/components/ui/button'
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
  <div class="mb-2 grid size-14 place-items-center rounded-full bg-highlight text-highlight-foreground"><TallyGlyph class="size-7" /></div>
  <h1 class="text-2xl font-semibold tracking-tight">Page not found</h1>
  <p class="text-muted-foreground">This page does not exist, or you are not a member of this group.</p>
  <Button href="/groups" class="mt-3">Go to your groups</Button>
</main>
