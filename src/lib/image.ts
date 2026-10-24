/**
 * Client-side image prep. Images are sent as close to the original as possible: a jpg/png/webp that is within the per-image cap
 * (5MB, worker MAX_IMAGE_BYTES) is sent byte-for-byte, with no re-encoding or downscaling. Only an image over the cap is
 * auto-compressed (JPEG, original resolution first, then smaller) until it fits, and the user is told.
 */
export const MAX_IMAGES = 5; // worker MAX_IMAGES
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // worker cap per image (decoded bytes, MAX_IMAGE_BYTES in wrangler.toml)
const MAX_DATA_URL = Math.ceil(MAX_IMAGE_BYTES / 3) * 4; // base64 chars of a cap-sized image (prefix is a few dozen chars on top)
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export interface PreparedImage { id: string; name: string; dataUrl: string; bytes: number; w: number; h: number; /** set when the original was over the cap and was re-encoded */ compressedFrom?: number }

export function acceptable(f: File) { return ACCEPT.includes(f.type); }

const readDataUrl = (file: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
const rawBytes = (dataUrl: string) => { const b = dataUrl.slice(dataUrl.indexOf(",") + 1); return Math.floor((b.length * 3) / 4) - (b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0); };

async function decode(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image(); img.decoding = "async"; img.src = dataUrl; await img.decode(); return img;
}

/** Re-encode as JPEG until ≤ cap: quality steps at full resolution first, then shrink the long edge. */
async function compressToFit(img: HTMLImageElement, cap: number): Promise<{ dataUrl: string; w: number; h: number }> {
  let edge = Math.max(img.naturalWidth, img.naturalHeight); let q = 0.92;
  for (let attempt = 0; attempt < 14; attempt++) {
    const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", q);
    if (rawBytes(dataUrl) <= cap * 0.98 || attempt === 13) return { dataUrl, w, h };
    if (q > 0.7) q -= 0.08; else edge = Math.round(edge * 0.85);
  }
  throw new Error("unreachable");
}

export async function prepareImage(file: File, cap = MAX_IMAGE_BYTES): Promise<PreparedImage> {
  const name = file.name || "粘贴的图片";
  const orig = await readDataUrl(file);
  const img = await decode(orig);
  if (file.size <= cap && orig.length <= MAX_DATA_URL + 64) return { id: crypto.randomUUID(), name, dataUrl: orig, bytes: file.size, w: img.naturalWidth, h: img.naturalHeight };
  const c = await compressToFit(img, cap);
  return { id: crypto.randomUUID(), name, dataUrl: c.dataUrl, bytes: rawBytes(c.dataUrl), w: c.w, h: c.h, compressedFrom: file.size };
}
export const fmtKB = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${Math.round(b / 1024)} KB`);
