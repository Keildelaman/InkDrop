export interface PageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SignaturePlacement {
  id: string;
  signatureId: string;
  dataUrl: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export type AppPhase = 'empty' | 'editing' | 'exporting';

export type SignatureInputMode = 'draw' | 'upload' | 'type';
