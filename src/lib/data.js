// Lectura y validación de los datos del catálogo (motos y textos del sitio).

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const fail = (message, status = 400) => json({ error: message }, status);

export async function readJson(request, maxBytes = 256 * 1024) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Cabeceras de seguridad de las páginas armadas por el servidor (el archivo _headers solo alcanza a los archivos estáticos).
export const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const parseList = (value) => { try { const parsed = JSON.parse(value ?? "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };

// Foto válida: subida desde el panel (/api/media/<n>) o enlace https.
export const imageUrl = (value) => {
  const url = String(value ?? "").trim().slice(0, 600);
  if (!url) return "";
  return /^\/api\/media\/\d+$/.test(url) || /^https:\/\/[^\s]+$/i.test(url) ? url : null;
};

/* ---------- Textos del sitio ---------- */
export const SITE_DEFAULTS = {
  whatsapp: "543754414727",
  phone: "+54 3754 414727",
  email: "contacto@goi-sa.com.ar",
  address: "Av. Belgrano y Las Heras 25, Leandro N. Alem, Misiones",
  instagram: "https://www.instagram.com/honda_goi_sa/",
  heroEyebrow: "Catálogo oficial Honda",
  heroTitle: "Encontrá tu próxima moto",
  heroCopy: "Mirá fotos, precio sugerido y ficha técnica de cada modelo, y pedí tu cotización sin moverte de casa.",
  heroModel: "cb750-hornet",
  usoOrder: "Ciudad, Trabajo, Aventura, Doble propósito, Deportivas y custom, Off-road, Cuatriciclos",
  trust1Title: "Concesionario oficial",
  trust1Text: "GOI S.A. vende y atiende motos Honda en Leandro N. Alem, Misiones.",
  trust2Title: "Datos de Honda",
  trust2Text: "Fotos, especificaciones y precio sugerido tomados de la web oficial de Honda Argentina.",
  trust3Title: "Te asesoramos",
  trust3Text: "Pedí tu cotización y un asesor te confirma precio final y disponibilidad.",
  quoteTitle: "Pedí tu cotización",
  quoteCopy: "Contanos qué moto te interesa y te respondemos por WhatsApp con el precio final y la disponibilidad.",
  footerNote: "Los precios son valores sugeridos al público por Honda Motor de Argentina, no incluyen flete, seguro ni patentamiento, y el precio final y la disponibilidad los confirma GOI. Fotos y especificaciones de Honda; pueden cambiar sin previo aviso.",
};

export async function loadSettings(db) {
  const settings = { ...SITE_DEFAULTS };
  const { results = [] } = await db.prepare("SELECT key, value FROM settings").all();
  for (const row of results) if (row.key in settings && row.value.trim()) settings[row.key] = row.value;
  return settings;
}

// Objeto que usa el armado de páginas (con valores fijos y los textos editables).
export async function loadSite(db, env) {
  const s = await loadSettings(db);
  return {
    domain: env.SITE_DOMAIN || "catalogo.goi-sa.com.ar", brand: "GOI Honda", legalName: "GOI S.A.",
    whatsapp: s.whatsapp, phone: s.phone, email: s.email, address: s.address, instagram: s.instagram,
    heroEyebrow: s.heroEyebrow, heroTitle: s.heroTitle, heroCopy: s.heroCopy, heroModel: s.heroModel,
    usoOrder: s.usoOrder.split(",").map((x) => x.trim()).filter(Boolean),
    trust: [1, 2, 3].map((n) => ({ title: s[`trust${n}Title`], text: s[`trust${n}Text`] })),
    quoteTitle: s.quoteTitle, quoteCopy: s.quoteCopy, footerNote: s.footerNote,
  };
}

/* ---------- Motos ---------- */
export function rowToModel(row) {
  const { versions_json, specs_json, features_json, colors_json, gallery_json, ...rest } = row;
  return { ...rest, versions: parseList(versions_json), specs: parseList(specs_json), features: parseList(features_json), colors: parseList(colors_json), gallery: parseList(gallery_json) };
}

export async function loadModels(db, { onlyActive = true } = {}) {
  const { results = [] } = await db.prepare(`SELECT * FROM models ${onlyActive ? "WHERE active = 1" : ""} ORDER BY sort_order, rowid`).all();
  return results.map(rowToModel);
}

export async function loadModel(db, slug) {
  const row = await db.prepare("SELECT * FROM models WHERE slug = ? AND active = 1").bind(String(slug).slice(0, 80)).first();
  return row ? rowToModel(row) : null;
}

// Valida los datos de una moto que llegan desde el panel. Devuelve null si algo está mal.
export function parseModelInput(body) {
  if (!body || typeof body !== "object") return null;
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  const name = text(body.name, 120);
  const sort = Number(body.sort_order ?? 0);
  const validTo = text(body.price_valid_to, 10);
  if (!name || !Number.isSafeInteger(sort)) return null;
  if (validTo && !/^\d{4}-\d{2}-\d{2}$/.test(validTo)) return null;
  const photo = imageUrl(body.photo_url);
  const pdf = imageUrl(body.spec_pdf_url);
  if (photo === null || pdf === null) return null;
  const versions = [];
  for (const raw of Array.isArray(body.versions) ? body.versions.slice(0, 12) : []) {
    const price = Number(raw?.price ?? 0);
    if (!Number.isSafeInteger(price) || price < 0) return null;
    const image = imageUrl(raw?.image);
    if (image === null) return null;
    versions.push({ name: text(raw?.name, 80), price, ...(image ? { image } : {}) });
  }
  const specs = (Array.isArray(body.specs) ? body.specs.slice(0, 60) : [])
    .map((r) => ({ label: text(r?.label, 100), value: text(r?.value, 300) })).filter((r) => r.label && r.value);
  const gallery = [];
  for (const raw of Array.isArray(body.gallery) ? body.gallery.slice(0, 30) : []) {
    const url = imageUrl(raw);
    if (url === null) return null;
    if (url) gallery.push(url);
  }
  return { name, segment: text(body.segment, 60), uso: text(body.uso, 60), tagline: text(body.tagline, 160), photo_url: photo, spec_pdf_url: pdf, price_valid_to: validTo, versions, specs, gallery, active: body.active ? 1 : 0, sort_order: sort };
}
