<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import Thumbnail from '../pdf/Thumbnail.svelte';
</script>

<aside class="w-[180px] shrink-0 border-r border-border bg-surface overflow-y-auto p-2 flex flex-col gap-1 max-md:hidden">
  <div class="text-xs font-medium text-text-muted px-2 py-1 uppercase tracking-wider">
    Pages
  </div>
  {#each appState.pages as _, i}
    <Thumbnail pageIndex={i} />
  {/each}
</aside>
