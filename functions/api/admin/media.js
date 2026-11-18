import { requireAdmin } from "../../../src/lib/auth.js";
import { fail, json, readJson } from "../../../src/lib/data.js";

// Tope del texto base64 (~1 MB de imagen): una fila de D1 admite hasta 2 MB. El panel achica las fotos antes de subirlas.
const MAX_BASE64 = 1_400_000;

// El tipo de archivo se decide por los primeros bytes, no por lo que diga el navegador.
function sniffMime(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await readJson(request, MAX_BASE64 + 4096);
  const data = typeof body?.data === "string" ? body.data : "";
  if (!data || data.length > MAX_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail("La foto es demasiado pesada o no es válida. Probá con una más chica.");
  let head;
  try { head = Uint8Array.from(atob(data.slice(0, 24)), (c) => c.charCodeAt(0)); } catch { return fail("La foto no es válida."); }
  const mime = sniffMime(head);
  if (!mime) return fail("Solo se aceptan fotos JPG, PNG o WebP.");
  const row = await env.DB.prepare("INSERT INTO media (name, mime, size, data) VALUES (?, ?, ?, ?) RETURNING id").bind(String(body?.name ?? "").trim().slice(0, 120), mime, Math.floor((data.length * 3) / 4), data).first();
  return json({ url: `/api/media/${row.id}` }, 201);
}
