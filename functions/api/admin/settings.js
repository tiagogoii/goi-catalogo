import { requireAdmin } from "../../../src/lib/auth.js";
import { SITE_DEFAULTS, fail, json, loadSettings, readJson } from "../../../src/lib/data.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  return json({ settings: await loadSettings(env.DB), defaults: SITE_DEFAULTS });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || typeof body !== "object") return fail("Datos inválidos.");
  const updates = {};
  for (const key of Object.keys(SITE_DEFAULTS)) if (key in body) updates[key] = String(body[key] ?? "").trim().slice(0, 700);
  if ("whatsapp" in updates && updates.whatsapp && !/^\d{10,15}$/.test(updates.whatsapp)) return fail("El WhatsApp va solo con números y con el código de país (por ejemplo 543754414727).");
  if ("instagram" in updates && updates.instagram && !/^https:\/\//i.test(updates.instagram)) return fail("El enlace de Instagram tiene que empezar con https://");
  const statements = Object.entries(updates).map(([k, v]) => env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v));
  if (statements.length) await env.DB.batch(statements);
  return json({ ok: true });
}
