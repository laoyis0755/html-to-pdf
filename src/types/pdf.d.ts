declare module 'jspdf' {
  class jsPDF {
    constructor(orientation?: 'p' | 'portrait' | 'l' | 'landscape', unit?: string, format?: string);
    addPage(): jsPDF;
    addImage(imageData: string, format: string, x: number, y: number, width: number, height: number, alias?: string, compression?: string): jsPDF;
    save(filename: string): void;
  }
  export default jsPDF;
}

declare module 'html2canvas' {
  interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    backgroundColor?: string;
  }

  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
