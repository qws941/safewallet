/**
 * Client-side image compression using Canvas API.
 * Resizes images above MAX_DIMENSION and compresses to JPEG.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Compress an image file using the browser Canvas API.
 * - Resizes if either dimension exceeds MAX_DIMENSION (preserving aspect ratio)
 * - Converts to JPEG at JPEG_QUALITY
 * - Returns original file if already small enough or if compression fails
 */
export async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Skip very small files (< 100KB) — not worth compressing
  if (file.size < 100 * 1024) {
    return file;
  }

  // Reject files over 10MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("이미지 크기는 10MB를 초과할 수 없습니다.");
  }

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Calculate new dimensions if needed
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Draw to canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Convert to JPEG blob
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    // Only use compressed version if it's actually smaller
    if (blob.size >= file.size) {
      return file;
    }

    // Create new File with original name but .jpg extension
    const name = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // If compression fails for any reason, return original
    return file;
  }
}

/**
 * Compress multiple image files in parallel.
 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
