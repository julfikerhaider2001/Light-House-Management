// Receipt photos are compressed on the device to ≤ 300 KB before upload (bucket cap).

export const MAX_RECEIPT_BYTES = 300 * 1024;

export async function compressImage(
  file: Blob,
  maxBytes = MAX_RECEIPT_BYTES,
  maxSide = 1600,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', quality),
        );
        if (blob && blob.size <= maxBytes) return blob;
      }
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`Could not compress the photo under ${Math.round(maxBytes / 1024)} KB`);
}
