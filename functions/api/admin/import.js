import { requireAdmin } from "../../../src/lib/auth.js";
import { json } from "../../../src/lib/data.js";
import honda from "../../../data/models.json";

// Grupo del filtro de la portada según el tipo que le asigna Honda.
const USO = { Cub: "Ciudad", Scooter: "Ciudad", Fun: "Ciudad", Business: "Trabajo", Adventure: "Aventura", "On-Off": "Doble propósito", Sport: "Deportivas y custom", Custom: "Deportivas y custom", "Off-Road": "Off-road", ATV: "Cuatriciclos" };
const empty = (v) => !v || v === "[]";

// Carga (o completa) las motos con las fichas oficiales de motos.honda.com.ar.
// Nunca pisa lo que ya se editó en el panel: solo completa campos vacíos. El precio solo se reemplaza
// si Honda publicó una vigencia más nueva que la guardada (un precio puesto a mano sin vigencia se respeta).
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const db = env.DB;
  const { results: existing = [] } = await db.prepare("SELECT * FROM models").all();
  const statements = [];
  let created = 0, updated = 0;
  for (const seed of honda) {
    const row = existing.find((r) => r.slug === seed.slug);
    const j = JSON.stringify;
    if (!row) {
      created += 1;
      statements.push(db.prepare(
        `INSERT INTO models (slug, name, segment, uso, tagline, image_url, hero_url, price_valid_to, versions_json, specs_json, features_json, colors_json, gallery_json, spec_pdf_url, source_url, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      ).bind(seed.slug, seed.name, seed.segment, USO[seed.segment] ?? "", seed.tagline, seed.image_url, seed.hero_url, seed.price_valid_to, j(seed.versions), j(seed.specs), j(seed.features), j(seed.colors), j(seed.gallery), seed.spec_pdf_url, seed.source_url, seed.sort_order));
      continue;
    }
    updated += 1;
    const newerPrice = empty(row.versions_json) || (Boolean(row.price_valid_to) && seed.price_valid_to > row.price_valid_to);
    statements.push(db.prepare(
      `UPDATE models SET segment=?, uso=?, tagline=?, image_url=?, hero_url=?, specs_json=?, features_json=?, colors_json=?, gallery_json=?, spec_pdf_url=?, source_url=?, versions_json=?, price_valid_to=?, updated_at=CURRENT_TIMESTAMP WHERE slug=?`,
    ).bind(
      row.segment || seed.segment, row.uso || USO[seed.segment] || "", row.tagline || seed.tagline, row.image_url || seed.image_url, row.hero_url || seed.hero_url,
      empty(row.specs_json) ? j(seed.specs) : row.specs_json, empty(row.features_json) ? j(seed.features) : row.features_json, empty(row.colors_json) ? j(seed.colors) : row.colors_json, empty(row.gallery_json) ? j(seed.gallery) : row.gallery_json,
      row.spec_pdf_url || seed.spec_pdf_url, row.source_url || seed.source_url,
      newerPrice ? j(seed.versions) : row.versions_json, newerPrice ? seed.price_valid_to : row.price_valid_to, seed.slug,
    ));
  }
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40));
  return json({ ok: true, created, updated, total: honda.length });
}
