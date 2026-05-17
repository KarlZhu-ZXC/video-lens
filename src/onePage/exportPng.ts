import { toPng } from 'html-to-image';

export async function exportElementAsPng(element: HTMLElement, scale: number, filename: string): Promise<string> {
  const dataUrl = await toPng(element, {
    pixelRatio: scale,
    cacheBust: true,
    backgroundColor: '#f7f3eb',
    skipFonts: true,
  });

  const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return dataUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mime = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}
