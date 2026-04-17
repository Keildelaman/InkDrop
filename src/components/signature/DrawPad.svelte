<script lang="ts">
  import { setupDrawCanvas } from '../../lib/signature/draw';
  import Button from '../ui/Button.svelte';

  interface Props {
    onconfirm: (dataUrl: string) => void;
  }

  let { onconfirm }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let drawApi: ReturnType<typeof setupDrawCanvas> | null = null;
  let selectedColor = $state('#1e293b');

  const colors = ['#1e293b', '#1e3a5f', '#7f1d1d', '#14532d'];

  $effect(() => {
    if (canvasEl && !drawApi) {
      drawApi = setupDrawCanvas(canvasEl);
      drawApi.resize(480, 160);
    }
    return () => {
      drawApi?.destroy();
      drawApi = null;
    };
  });

  function handleColorChange(color: string) {
    selectedColor = color;
    drawApi?.setColor(color);
  }

  function handleConfirm() {
    if (!drawApi || drawApi.isEmpty()) return;
    const dataUrl = drawApi.toDataUrl();
    onconfirm(dataUrl);
  }
</script>

<div class="flex flex-col gap-4">
  <div class="border border-border rounded-xl overflow-hidden bg-white">
    <canvas bind:this={canvasEl} class="w-full cursor-crosshair"></canvas>
  </div>

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      {#each colors as color}
        <button
          class="w-7 h-7 rounded-full border-2 transition-all cursor-pointer
            {selectedColor === color ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}"
          style="background-color: {color}"
          onclick={() => handleColorChange(color)}
          title="Select color"
        ></button>
      {/each}
    </div>

    <div class="flex items-center gap-2">
      <Button variant="ghost" size="sm" onclick={() => drawApi?.undo()}>Undo</Button>
      <Button variant="ghost" size="sm" onclick={() => drawApi?.clear()}>Clear</Button>
    </div>
  </div>

  <Button variant="primary" onclick={handleConfirm}>
    Use This Signature
  </Button>
</div>
