export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
const TARGET_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_BYTES - 96 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export type PreparedImage = {
  file: File;
  wasOptimized: boolean;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Image preparation was cancelled", "AbortError");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Your browser could not prepare this image.")), type, quality);
  });
}

async function loadImageSource(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void; close?: () => void }> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be decoded."));
      element.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function prepareImageForUpload(file: File, signal?: AbortSignal): Promise<PreparedImage> {
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error("Please upload a PNG, JPG, GIF, or WebP image.");
  if (file.size === 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("Choose an image smaller than 25MB before uploading.");
  if (file.size <= MAX_IMAGE_UPLOAD_BYTES) return { file, wasOptimized: false };
  if (file.type === "image/gif") throw new Error("Animated GIFs over 2MB cannot be compressed safely. Choose a smaller GIF.");

  throwIfAborted(signal);
  const source = await loadImageSource(file);
  try {
    if (!source.width || !source.height) throw new Error("This image has invalid dimensions.");
    const outputType = file.type === "image/png" ? "image/png" : file.type;
    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
    let width = Math.max(1, Math.round(source.width * initialScale));
    let height = Math.max(1, Math.round(source.height * initialScale));
    const qualitySteps = outputType === "image/png" ? [undefined] : [0.9, 0.82, 0.74, 0.66];

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      for (const quality of qualitySteps) {
        throwIfAborted(signal);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: outputType === "image/png" });
        if (!context) throw new Error("Your browser could not prepare this image.");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        source.draw(context, width, height);
        const blob = await canvasToBlob(canvas, outputType, quality);
        if (blob.size <= TARGET_IMAGE_UPLOAD_BYTES) {
          const extension = outputType === "image/jpeg" ? "jpg" : outputType.split("/")[1];
          const filename = file.name.replace(/\.[^.]+$/, "") + `.${extension}`;
          return {
            file: new File([blob], filename, { type: outputType, lastModified: file.lastModified }),
            wasOptimized: true,
          };
        }
      }
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }
  } finally {
    source.close?.();
  }

  throw new Error("We could not reduce this image below 2MB. Please choose a smaller image.");
}
