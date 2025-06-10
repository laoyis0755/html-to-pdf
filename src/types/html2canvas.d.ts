import { Options } from 'html2canvas';

declare module 'html2canvas' {
  interface Html2CanvasOptions extends Options {
    width?: number;
    height?: number;
    scale?: number;
  }
}
