// Lee motos.honda.com.ar (lista + una página por modelo) y deja honda-raw.json.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const BASE = "https://motos.honda.com.ar";
const OUT = process.argv[2];
const get = async (p) => (await fetch(new URL(p, BASE + "/modelos/"), { headers: { "user-agent": "Mozilla/5.0" } })).text();
const clean = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const dec = (s) => s.replace(/&nbsp;/g, " ").replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú").replace(/&uuml;/g, "ü").replace(/&iquest;/g, "¿").replace(/&iexcl;/g, "¡").replace(/&trade;/g, "™").replace(/&reg;/g, "®").replace(/&copy;/g, "©").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&ordm;/g, "º").replace(/&deg;/g, "°");
const text = (s) => dec(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const abs = (u) => encodeURI(decodeURI(new URL(u, BASE + "/modelos/x").href));

const home = clean(await get("/"));
const list = [...home.matchAll(/<a[^>]*href="\/modelos\/([a-z0-9-]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*\/>\s*<span>([^<]+)<\/span>/g)];
const seen = new Map();
for (const m of list) if (!seen.has(m[1])) seen.set(m[1], { slug: m[1], thumb: abs(m[2]), name: dec(m[3]).trim() });
// categoría: aparece como título de grupo antes de cada bloque de modelos
const cats = {};
{
  const re = /<(?:p|h\d|span|div)[^>]*>\s*([A-ZÁÉÍÓÚ-]{3,12})\s*<\/(?:p|h\d|span|div)>|href="\/modelos\/([a-z0-9-]+)"/g;
  let cur = "";
  for (const m of home.matchAll(re)) { if (m[1]) cur = m[1]; else if (m[2] && !(m[2] in cats)) cats[m[2]] = cur; }
}

const out = [];
for (const [slug, base] of seen) {
  const html = clean(await get(`/modelos/${slug}`));
  const hero = html.match(/<h1[^>]*>([^<]*)<\/h1>\s*<p class="subheading"[^>]*>([^<]*)<\/p>/);
  const heroImgs = [...html.matchAll(/<img class="(desktop|mobile) img-fluid" src="([^"]+main_sliders[^"]+)"/g)].map((m) => ({ kind: m[1], url: abs(m[2]) }));
  const colors = [...html.matchAll(/class="color_bullet[^"]*" style="background-color:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => m[1].toLowerCase());
  // versiones
  const versions = [];
  for (const t of html.matchAll(/<p class="tab-link[^"]*" id="model_version_(\d+)_id"[^>]*>([^<]*)<\/p>/g)) {
    const id = t[1];
    const i = html.indexOf(`id="model_version_${id}_info"`);
    let blk = html.slice(i, i + 3500);
    const next = blk.indexOf('class="model_version_info', 40);
    if (next > 0) blk = blk.slice(0, next);
    const img = blk.match(/class="img-fluid version-image" src="([^"]+)"/);
    const price = blk.match(/<div class="price-container"><p>\s*\$?\s*([\d.]+)/);
    const dates = blk.match(/desde el (\d{2}\/\d{2}\/\d{4}) hasta el (\d{2}\/\d{2}\/\d{4})/);
    versions.push({ name: dec(t[2]).trim(), image: img ? abs(img[1]) : null, price: price ? Number(price[1].replace(/\./g, "")) : null, validFrom: dates?.[1] ?? null, validTo: dates?.[2] ?? null });
  }
  // características (set de escritorio)
  const dsk = html.indexOf('class="desktop features_sliders_c"');
  const feat = [];
  if (dsk > 0) {
    const part = html.slice(dsk);
    for (const sec of part.split('<div class="swiper-row">').slice(1)) {
      const title = sec.match(/<p class="main-heading">([^<]*)<\/p>/);
      const img = sec.match(/<img class="img-fluid" src="([^"]+models_feature_slides[^"]+)"/);
      const head = sec.match(/<span class="heading">([^<]*)<\/span>/);
      const desc = sec.match(/<div class="description">([\s\S]*?)<\/div>/);
      if (title) feat.push({ section: text(title[1]), heading: head ? text(head[1]) : "", text: desc ? text(desc[1]) : "", image: img ? abs(img[1]) : null });
    }
  }
  const pdfs = [...html.matchAll(/href="([^"]+\.pdf)"/g)].map((m) => abs(m[1]));
  out.push({ ...base, name: hero ? text(hero[1]) || base.name : base.name, category: cats[slug] ?? "", tagline: hero ? text(hero[2]) : "", heroImages: heroImgs, colors, versions, features: feat, pdfs });
  console.log(slug, "v:" + versions.length, "f:" + feat.length, "pdf:" + pdfs.length, "colors:" + colors.length, cats[slug]);
}
// Fichas técnicas: se baja el PDF de cada modelo y se convierte a texto con pdftotext (viene con Git for Windows).
// El primer enlace .pdf que dice "ficha" es la ficha; el otro suele ser el manual del usuario.
const dir = path.dirname(OUT);
fs.mkdirSync(path.join(dir, "pdf"), { recursive: true });
fs.mkdirSync(path.join(dir, "txt"), { recursive: true });
for (const model of out) {
  const url = model.pdfs.find((p) => /ficha/i.test(decodeURI(p)));
  if (!url) { console.log("sin ficha técnica:", model.slug); continue; }
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || bytes.subarray(0, 4).toString() !== "%PDF") { console.log("ficha no disponible:", model.slug, response.status); continue; }
  const pdf = path.join(dir, "pdf", `${model.slug}.pdf`);
  fs.writeFileSync(pdf, bytes);
  execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdf, path.join(dir, "txt", `${model.slug}.txt`)]);
  model.specPdf = url;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
