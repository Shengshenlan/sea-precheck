/** Self-contained auth for Workers: PBKDF2 password hashing + HS256 JWT, WebCrypto only (no deps). */
const te = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

/** constant-time comparison */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
// workerd caps PBKDF2 at 100k iterations.
export async function hashPassword(password: string, iterations = 100_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations))}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, it, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2-sha256") return false;
  return safeEqual(await pbkdf2(password, unb64(salt), parseInt(it, 10)), unb64(hash));
}
/** A fixed dummy hash so that login for unknown emails costs the same time. */
export const DUMMY_HASH = "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(data)));
}
export const hmacHex = async (secret: string, data: string) => [...(await hmac(secret, data))].map((x) => x.toString(16).padStart(2, "0")).join("");

/** v = users.token_ver at issue time; a password reset bumps it, which invalidates older tokens. */
export interface JwtPayload { sub: number; email: string; v?: number; iat: number; exp: number }
export async function signJwt(p: Omit<JwtPayload, "iat" | "exp">, secret: string, ttlSec = 7 * 86400): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(te.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const b = b64url(te.encode(JSON.stringify({ ...p, iat: now, exp: now + ttlSec })));
  return `${h}.${b}.${b64url(await hmac(secret, `${h}.${b}`))}`;
}
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
    if (head.alg !== "HS256") return null; // never accept alg=none / RS* confusion
    if (!safeEqual(await hmac(secret, `${parts[0]}.${parts[1]}`), unb64url(parts[2]))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64url(parts[1]))) as JwtPayload;
    if (typeof p.sub !== "number" || typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

/** Uniform 6-digit one-time code (rejection sampling, no modulo bias). */
export function sixDigitCode(): string {
  const buf = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(buf); if (buf[0] < 4_294_000_000) return String(buf[0] % 1_000_000).padStart(6, "0"); }
}
/** Codes are stored only as HMAC(JWT_SECRET, purpose|email|code). */
export const codeHash = (secret: string, purpose: string, email: string, code: string) => hmacHex(secret, `code|${purpose}|${email}|${code}`);
export const hexEqual = (a: string, b: string) => safeEqual(te.encode(a), te.encode(b));

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
/** Returns a Chinese error message, or null if acceptable. */
export function passwordProblem(pw: unknown, email: string): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "密码至少 8 位";
  if (pw.length > 128) return "密码最长 128 位";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "密码需同时包含字母和数字";
  if (pw.toLowerCase() === email.toLowerCase() || pw.toLowerCase() === email.split("@")[0].toLowerCase()) return "密码不能与邮箱相同";
  if (/^(password|12345678|qwerty12|abc12345|11111111)/i.test(pw)) return "密码过于常见";
  return null;
}
