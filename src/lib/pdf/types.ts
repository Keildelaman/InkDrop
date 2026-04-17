import type { PageInfo } from '../../types';

export type { PageInfo };

export interface RenderOptions {
  scale: number;
  pageIndex: number;
  canvas: HTMLCanvasElement;
}
