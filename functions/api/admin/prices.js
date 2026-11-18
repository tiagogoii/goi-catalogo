import { requireAdmin } from "../../../src/lib/auth.js";
import { fail, json, readJson, rowToModel } from "../../../src/lib/data.js";

// Actualización masiva de precios (la tarea del cambio de mes).
// Recibe [{ slug, prices: [precio de la versión 1, precio de la versión 2…], price_valid_to }]. Solo cambia precios y vigencia.
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await readJson(request, 512 * 1024);
  if (!Array.isArray(body?.items) || body.items.length > 200) return fail("Datos inválidos.");
  const statements = [];
  for (const item of body.items) {
    const validTo = String(item?.price_valid_to ?? "").trim();
    if (validTo && !/^\d{4}-\d{2}-\d{2}$/.test(validTo)) return fail("Hay una fecha de vigencia inválida.");
    const prices = Array.isArray(item?.prices) ? item.prices.map(Number) : null;
    if (!prices || prices.some((p) => !Number.isSafeInteger(p) || p < 0)) return fail("Hay un precio inválido: tienen que ser números enteros en pesos.");
    const row = await env.DB.prepare("SELECT * FROM models WHERE slug = ?").bind(String(item.slug)).first();
    if (!row) continue;
    const model = rowToModel(row);
    const versions = model.versions.map((v, i) => ({ ...v, price: prices[i] ?? v.price }));
    statements.push(env.DB.prepare("UPDATE models SET versions_json = ?, price_valid_to = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?").bind(JSON.stringify(versions), validTo, model.slug));
  }
  for (let i = 0; i < statements.length; i += 40) await env.DB.batch(statements.slice(i, i + 40));
  return json({ ok: true, updated: statements.length });
}
