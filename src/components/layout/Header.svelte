<script lang="ts">
  import ThemeToggle from '../ui/ThemeToggle.svelte';
</script>

<header class="h-14 flex items-center justify-between px-4 border-b border-border bg-surface-elevated shrink-0">
  <div class="flex items-center gap-2">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
    <h1 class="text-lg font-semibold tracking-tight">InkDrop</h1>
  </div>
  <div class="flex items-center gap-2">
    <ThemeToggle />
  </div>
</header>
