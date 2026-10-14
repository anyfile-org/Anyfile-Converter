/**
 * In-browser client-side file conversion engine for Web Mode (Vercel).
 * All conversions occur 100% locally in browser memory using HTML5 Canvas and FileReader.
 * Zero bytes are transmitted to any server.
 */

export interface WebConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
}

export const convertImageClientSide = async (
  file: File,
  targetFormat: 'png' | 'jpg' | 'webp' | 'avif',
  quality: number = 0.8
): Promise<WebConversionResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      // If output is JPEG, draw a white background first to avoid transparent pixels becoming black
      if (targetFormat === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const mimeType =
        targetFormat === 'png'
          ? 'image/png'
          : targetFormat === 'webp'
          ? 'image/webp'
          : targetFormat === 'avif'
          ? 'image/avif'
          : 'image/jpeg';

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const extension = targetFormat === 'jpg' ? 'jpg' : targetFormat;
      const newFileName = `${baseName}_converted.${extension}`;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          if (blob.type !== mimeType) {
            reject(new Error(`This browser does not support ${targetFormat.toUpperCase()} encoding`));
            return;
          }
          resolve({
            blob,
            fileName: newFileName,
            mimeType,
            size: blob.size,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
};

export const compressImageClientSide = async (
  file: File,
  qualityPercent: number = 75
): Promise<WebConversionResult> => {
  const quality = Math.min(Math.max(qualityPercent / 100, 0.05), 0.95);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png'].includes(extension ?? '')) {
    throw new Error('Image compression supports JPG, JPEG, and PNG files.');
  }
  const result = await convertImageClientSide(
    file,
    extension === 'png' ? 'png' : 'jpg',
    quality
  );
  return {
    ...result,
    fileName: result.fileName.replace('_converted.', '_compressed.'),
  };
};

export const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
