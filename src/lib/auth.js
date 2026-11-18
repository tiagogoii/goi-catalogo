// Sesión del panel de administración: una clave (ADMIN_PASSWORD) y una cookie firmada.
const COOKIE = "goi_admin";
const MAX_AGE = 8 * 60 * 60; // 8 horas

const enc = new TextEncoder();
const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

// Compara en tiempo constante (se comparan los hashes, así no importa el largo).
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;
  return safeEqual(String(password ?? ""), env.ADMIN_PASSWORD);
}

export async function sessionCookie(env, request) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const signature = await hmac(env.SESSION_SECRET, `admin.${expires}`);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${expires}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = (request.headers.get("cookie") ?? "").split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  if (!cookie) return false;
  const [expires, signature] = cookie.slice(COOKIE.length + 1).split(".");
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, await hmac(env.SESSION_SECRET, `admin.${expires}`));
}

// Devuelve una respuesta de error si no hay sesión; null si todo está bien.
export async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) {
    return new Response(JSON.stringify({ error: "Iniciá sesión para continuar." }), { status: 401, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  // Los cambios solo se aceptan como JSON desde el propio sitio (protección extra contra pedidos de otros sitios).
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return new Response(JSON.stringify({ error: "Origen no permitido." }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
    }
  }
  return null;
}
