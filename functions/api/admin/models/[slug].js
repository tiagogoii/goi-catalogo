import { requireAdmin } from "../../../../src/lib/auth.js";
import { fail, json, parseModelInput, readJson } from "../../../../src/lib/data.js";

// Edita una moto. La dirección pública (slug) no cambia, para no romper enlaces ya compartidos.
export async function onRequestPut({ request, params, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const m = parseModelInput(await readJson(request));
  if (!m) return fail("Revisá los datos: el nombre es obligatorio, los precios tienen que ser números y las fotos enlaces https o subidas desde el panel.");
  const result = await env.DB.prepare(
    `UPDATE models SET name=?, segment=?, uso=?, tagline=?, photo_url=?, spec_pdf_url=?, price_valid_to=?, versions_json=?, specs_json=?, gallery_json=?, active=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE slug=?`,
  ).bind(m.name, m.segment, m.uso, m.tagline, m.photo_url, m.spec_pdf_url, m.price_valid_to, JSON.stringify(m.versions), JSON.stringify(m.specs), JSON.stringify(m.gallery), m.active, m.sort_order, String(params.slug)).run();
  return result.meta.changes ? json({ ok: true }) : fail("No encontramos esa moto.", 404);
}
