<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x'
  import * as Drawer from '$lib/components/ui/drawer'
</script>

<Drawer.Close
  type="button"
  class="absolute top-2 right-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
  aria-label="Close"
>
  <XIcon class="size-5" />
</Drawer.Close>
