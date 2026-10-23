/** Client-side image prep: decode, downscale to ≤1024px long edge, re-encode JPEG until all images fit the budget. */
export const MAX_IMAGES = 3;
export const TOTAL_BUDGET = 1_500_000; // bytes of base64 across all images (worker hard cap is ~2MB)
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export interface PreparedImage { id: string; name: string; dataUrl: string; bytes: number; w: number; h: number }

export function acceptable(f: File) { return ACCEPT.includes(f.type); }

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.decoding = "async"; img.src = url; await img.decode(); return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export async function prepareImage(file: File, perImageBudget: number, maxEdge = 1024): Promise<PreparedImage> {
  const img = await decode(file);
  let edge = maxEdge; let q = 0.85;
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", q);
    if (dataUrl.length <= perImageBudget || attempt === 7) return { id: crypto.randomUUID(), name: file.name || "粘贴的图片", dataUrl, bytes: dataUrl.length, w, h };
    if (q > 0.6) q -= 0.12; else edge = Math.round(edge * 0.8);
  }
  throw new Error("unreachable");
}
export const fmtKB = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${Math.round(b / 1024)} KB`);
