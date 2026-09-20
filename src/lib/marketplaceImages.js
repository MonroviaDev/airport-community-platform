const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.76;
const MAX_FILES = 4;
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to read this image.")); };
    img.src = url;
  });
}

export async function compressMarketplaceImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose image files only.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("Each original photo must be 12 MB or smaller.");

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
  if (!blob) throw new Error("Unable to compress this image.");
  return blob;
}

export function validateMarketplacePhotoSelection(files) {
  const selected = Array.from(files || []);
  if (selected.length > MAX_FILES) throw new Error("Choose up to 4 photos per listing.");
  selected.forEach((file) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose image files only.");
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error("Each original photo must be 12 MB or smaller.");
  });
  return selected;
}
