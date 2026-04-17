<script lang="ts">
  import { SIGNATURE_FONTS, renderTextSignature } from '../../lib/signature/text';
  import Button from '../ui/Button.svelte';

  interface Props {
    onconfirm: (dataUrl: string) => void;
  }

  let { onconfirm }: Props = $props();

  let name = $state('');
  let selectedFont = $state<string>(SIGNATURE_FONTS[0].name);
  let selectedColor = $state('#1e293b');

  const colors = ['#1e293b', '#1e3a5f', '#7f1d1d', '#14532d'];

  function handleConfirm() {
    if (!name.trim()) return;
    const dataUrl = renderTextSignature(name.trim(), selectedFont, selectedColor);
    onconfirm(dataUrl);
  }
</script>

<div class="flex flex-col gap-4">
  <input
    type="text"
    bind:value={name}
    placeholder="Type your name..."
    class="w-full px-4 py-3 border border-border rounded-xl bg-surface text-text text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
  />

  <!-- Font previews -->
  <div class="flex flex-col gap-2">
    {#each SIGNATURE_FONTS as font}
      <button
        class="text-left px-4 py-3 rounded-xl border transition-all cursor-pointer
          {selectedFont === font.name
            ? 'border-accent bg-accent-light'
            : 'border-border hover:border-accent/50'}"
        onclick={() => selectedFont = font.name}
      >
        <span class="text-xs text-text-muted mb-1 block">{font.label}</span>
        <span
          style="font-family: '{font.name}'; color: {selectedColor};"
          class="text-3xl"
        >
          {name || 'Your Name'}
        </span>
      </button>
    {/each}
  </div>

  <!-- Colors -->
  <div class="flex items-center gap-2">
    <span class="text-sm text-text-muted">Color:</span>
    {#each colors as color}
      <button
        class="w-7 h-7 rounded-full border-2 transition-all cursor-pointer
          {selectedColor === color ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}"
        style="background-color: {color}"
        onclick={() => selectedColor = color}
        title="Select color"
      ></button>
    {/each}
  </div>

  <Button variant="primary" onclick={handleConfirm} disabled={!name.trim()}>
    Use This Signature
  </Button>
</div>
