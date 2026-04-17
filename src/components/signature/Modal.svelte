<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { saveSignature } from '../../lib/signature/store';
  import { getImageDimensions } from '../../lib/image-utils';
  import ModalWrapper from '../ui/Modal.svelte';
  import DrawPad from './DrawPad.svelte';
  import UploadPad from './UploadPad.svelte';
  import TypePad from './TypePad.svelte';
  import SavedList from './SavedList.svelte';
  import type { SignatureInputMode } from '../../types';

  let activeTab = $state<SignatureInputMode>('draw');

  const tabs: { id: SignatureInputMode; label: string }[] = [
    { id: 'draw', label: 'Draw' },
    { id: 'upload', label: 'Upload' },
    { id: 'type', label: 'Type' },
  ];

  async function handleSignatureCreated(dataUrl: string) {
    // Save to IndexedDB
    const sig = {
      id: crypto.randomUUID(),
      name: `Signature ${appState.savedSignatures.length + 1}`,
      dataUrl,
      createdAt: Date.now(),
    };
    await saveSignature(sig);
    appState.addSavedSignature(sig);

    // Place on current page
    const dims = await getImageDimensions(dataUrl);
    appState.addPlacement(sig.id, sig.dataUrl, dims.width, dims.height);
    appState.closeSignatureModal();
  }

  async function handleSavedSelected(signatureId: string) {
    const sig = appState.savedSignatures.find((s) => s.id === signatureId);
    if (!sig) return;
    const dims = await getImageDimensions(sig.dataUrl);
    appState.addPlacement(sig.id, sig.dataUrl, dims.width, dims.height);
    appState.closeSignatureModal();
  }
</script>

<ModalWrapper
  open={appState.signatureModalOpen}
  onclose={() => appState.closeSignatureModal()}
  title="Add Signature"
  maxWidth="max-w-lg"
>
  <!-- Tabs -->
  <div class="flex border-b border-border -mx-6 -mt-2 px-6 mb-4">
    {#each tabs as tab}
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors relative cursor-pointer
          {activeTab === tab.id
            ? 'text-accent'
            : 'text-text-muted hover:text-text'}"
        onclick={() => activeTab = tab.id}
      >
        {tab.label}
        {#if activeTab === tab.id}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"></div>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  {#if activeTab === 'draw'}
    <DrawPad onconfirm={handleSignatureCreated} />
  {:else if activeTab === 'upload'}
    <UploadPad onconfirm={handleSignatureCreated} />
  {:else if activeTab === 'type'}
    <TypePad onconfirm={handleSignatureCreated} />
  {/if}

  <!-- Saved signatures -->
  <SavedList onselect={handleSavedSelected} />
</ModalWrapper>
