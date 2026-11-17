// Arma lib/honda-models.json a partir de honda-raw.json (scrape.mjs) y del texto de las fichas (pdftotext -layout).
// Uso: node scripts/honda-catalog/build.mjs <carpeta-de-trabajo> <salida.json>
// La carpeta de trabajo tiene honda-raw.json y txt/<slug>.txt. Ver README.md de esta carpeta.
import fs from "node:fs";
import path from "node:path";

const [work, out] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(path.join(work, "honda-raw.json"), "utf8"));

// Categorías según el sitio de Honda (la página las muestra como grupos de la grilla de modelos).
const categories = {
  "wave-110s": "Cub", "biz-110": "Cub", navi: "Fun", "glh-150": "Business", "elite-125": "Scooter", "pcx-160": "Scooter",
  xr150l: "On-Off", xr190l: "On-Off", "xr300l-tornado": "On-Off",
  crf250r: "Off-Road", crf250rx: "Off-Road", crf450r: "Off-Road", crf450rx: "Off-Road",
  "cb350-h-ness": "Custom", "cb125f-twister": "Sport", "cb190r-2-0": "Sport", "cb300f-twister": "Sport", "cb500-hornet": "Sport", "cb750-hornet": "Sport",
  nx190: "Adventure", nx500: "Adventure", nc750x: "Adventure", "xl750-transalp": "Adventure", "crf1100l-africa-twin": "Adventure", "crf1100l-africa-twin-as": "Adventure",
  trx250: "ATV", trx420: "ATV",
};

// Una ficha son dos columnas: etiquetas a la izquierda y valores a la derecha. El valor n corresponde a la etiqueta n.
function parseSheet(block) {
  const lines = block.replace(/\f/g, "").split(/\r?\n/);
  const start = lines.findIndex((l) => /FICHA T[ÉE]CNICA/.test(l));
  if (start < 0) return null;
  const first = lines[start];
  const rest = first.replace(/^.*?FICHA T[ÉE]CNICA\s*/, "");
  const col = first.length - rest.length;
  if (!rest) {
    // Formato B: cada fila trae etiqueta y valor en la misma línea.
    const rows = [];
    let started = false;
    for (const line of lines.slice(start + 1)) {
      if (!line.trim()) { if (started) break; continue; }
      started = true;
      const m = line.trim().match(/^(.*?\S)\s{2,}(\S.*)$/);
      if (m && !/^colores/i.test(m[1])) rows.push({ label: m[1], value: m[2] });
    }
    return rows;
  }
  const labels = [];
  const values = [first.slice(col).trim()];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) break;
    const label = line.slice(0, col).trim();
    const value = line.slice(col).trim();
    if (label) labels.push(label);
    if (value) values.push(value);
  }
  return labels.map((label, i) => ({ label, value: values[i] ?? "" })).filter((r) => r.value);
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, " ");
const titleLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Los rótulos del PDF son poco claros ("Motor" lleva el tipo de motor, "Transmisión" la caja, etc.): se respetan tal cual.
function mergeBlocks(blocks, versionNames) {
  if (blocks.length === 0) return [];
  if (blocks.length === 1) return blocks[0].map((r) => ({ label: titleLabel(r.label), value: r.value }));
  // Dos fichas (versión E-Clutch y MT): la E-Clutch pesa más por el actuador del embrague.
  const weight = (b) => Number((b.find((r) => /^peso/i.test(r.label))?.value ?? "").replace(/\D/g, "")) || 0;
  const sorted = [...blocks].sort((a, b) => weight(b) - weight(a));
  const names = versionNames.length === 2 ? (/e-clutch/i.test(versionNames[0]) ? [versionNames[0], versionNames[1]] : [versionNames[1], versionNames[0]]) : ["Versión 1", "Versión 2"];
  const short = names.map((n) => (/e-clutch/i.test(n) ? "E-Clutch" : /\bMT\b/.test(n) ? "MT" : n));
  return sorted[0].map((r, i) => {
    const other = sorted[1][i];
    return other && norm(other.value) !== norm(r.value) ? { label: titleLabel(r.label), value: `${short[0]}: ${r.value} / ${short[1]}: ${other.value}` } : { label: titleLabel(r.label), value: r.value };
  });
}

const models = raw.map((m, index) => {
  const file = path.join(work, "txt", `${m.slug}.txt`);
  const txt = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const blocks = txt ? txt.split(/(?=^.*FICHA T[ÉE]CNICA)/m).map(parseSheet).filter(Boolean) : [];
  const toDate = (s) => (s ? s.split("/").reverse().join("-") : "");
  const versions = m.versions.map((v) => ({ name: m.versions.length > 1 ? v.name : "", price: v.price ?? 0, image: v.image ?? "" }));
  const validTo = m.versions.map((v) => toDate(v.validTo)).filter(Boolean).sort().pop() ?? "";
  const gallery = [...new Set([...m.versions.map((v) => v.image), ...m.features.map((f) => f.image)].filter(Boolean))];
  return {
    slug: m.slug,
    name: m.name.replace(/^Biz 110$/, "BIZ 110").replace(/^PCX160$/, "PCX 160").replace(/^AFRICA TWIN$/, "CRF1100L AFRICA TWIN").replace(/^AFRICA TWIN AS$/, "CRF1100L AFRICA TWIN ADVENTURE SPORTS"),
    segment: categories[m.slug] ?? "",
    tagline: m.tagline,
    image_url: m.thumb,
    hero_url: m.heroImages.find((h) => h.kind === "desktop")?.url ?? "",
    price_valid_to: validTo,
    versions,
    specs: mergeBlocks(blocks, m.versions.map((v) => v.name)),
    features: m.features.map((f) => ({ section: f.section, heading: f.heading, text: f.text, image: f.image ?? "" })),
    colors: m.colors,
    gallery,
    spec_pdf_url: m.specPdf ?? "",
    source_url: `https://motos.honda.com.ar/modelos/${m.slug}`,
    sort_order: index,
  };
});

// Entidades HTML que quedaron sin decodificar en los textos de Honda (™, ®, comillas, etc.).
const entities = { trade: "™", reg: "®", copy: "©", acute: "´", hellip: "…", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", times: "×" };
const fixEntities = (value) => (typeof value === "string"
  ? value.replace(/&([a-z]+);/gi, (match, name) => entities[name] ?? match).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  : Array.isArray(value) ? value.map(fixEntities)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixEntities(v)]))
  : value);

fs.writeFileSync(out, JSON.stringify(fixEntities(models), null, 1) + "\n");
for (const m of models) console.log(m.slug.padEnd(26), "specs:", String(m.specs.length).padStart(2), "versions:", m.versions.map((v) => v.price || "consultar").join("/"), "gallery:", m.gallery.length);
