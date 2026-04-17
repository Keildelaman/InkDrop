import type { SavedSignature } from '../../types';
import { getAll, put, del } from '../storage';

export async function loadSignatures(): Promise<SavedSignature[]> {
  return getAll<SavedSignature>();
}

export async function saveSignature(sig: SavedSignature): Promise<void> {
  await put(sig);
}

export async function deleteSignature(id: string): Promise<void> {
  await del(id);
}
