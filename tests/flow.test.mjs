// Prueba de punta a punta del catálogo contra el servidor local (npm run dev). Uso: npm test
// Necesita .dev.vars con ADMIN_PASSWORD. Trabaja sobre la base LOCAL y deja las motos importadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8789";
const vars = Object.fromEntries(fs.readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
let cookie = "";

async function call(path, { method = "GET", body, auth = false, raw = false } = {}) {
  const response = await fetch(BASE + path, { method, redirect: "manual", headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return response;
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { html: text }; }
  return { status: response.status, data, headers: response.headers };
}
const model = async (slug) => (await call("/api/admin/models", { auth: true })).data.models.find((m) => m.slug === slug);

test("el panel exige clave y la sesión funciona", async () => {
  assert.equal((await call("/api/admin/models")).status, 401);
  assert.equal((await call("/api/admin/import", { method: "POST", body: {} })).status, 401);
  assert.equal((await call("/api/admin/login", { method: "POST", body: { password: "mala" } })).status, 401);
  const response = await call("/api/admin/login", { method: "POST", body: { password: vars.ADMIN_PASSWORD }, raw: true });
  assert.equal(response.status, 200);
  cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("/api/admin/models", { auth: true })).status, 200);
});

test("importar las fichas de Honda carga las 27 motos y no duplica", async () => {
  const first = await call("/api/admin/import", { method: "POST", auth: true, body: {} });
  assert.equal(first.status, 200);
  assert.equal(first.data.total, 27);
  const again = await call("/api/admin/import", { method: "POST", auth: true, body: {} });
  assert.equal(again.data.created, 0);
  assert.equal((await call("/api/admin/models", { auth: true })).data.models.length, 27);
});

test("el catálogo público muestra las motos, los grupos y el precio", async () => {
  const home = await call("/");
  assert.equal(home.status, 200);
  assert.equal((home.data.html.match(/class="card-item"/g) ?? []).length, 27);
  for (const grupo of ["Ciudad", "Aventura", "Doble propósito", "Deportivas y custom", "Off-road", "Cuatriciclos"]) assert.ok(home.data.html.includes(`data-uso="${grupo}"`), grupo);
  assert.ok(home.data.html.includes("Elegí tu moto"));
  assert.ok(home.headers.get("content-security-policy"));
  assert.equal((await call("/sitemap.xml")).data.html.match(/<loc>/g).length, 28);
});

test("la ficha de una moto abre con y sin barra final, y las inexistentes dan 404", async () => {
  const a = await call("/modelos/xr150l/");
  const b = await call("/modelos/xr150l");
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.ok(a.data.html.includes("XR150L") && a.data.html.includes("Ficha técnica"));
  assert.equal((await call("/modelos/no-existe/")).status, 404);
});

test("editar una moto cambia la página pública (precio, textos y foto subida)", async () => {
  const m = await model("xr150l");
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082", "hex").toString("base64");
  const up = await call("/api/admin/media", { method: "POST", auth: true, body: { name: "uno.png", data: png } });
  assert.equal(up.status, 201);
  const body = { ...m, name: "XR150L Edición prueba", tagline: "Frase de prueba", price_valid_to: "2099-12-31", versions: [{ name: "", price: 7123456, image: m.versions[0].image }], photo_url: up.data.url };
  assert.equal((await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body })).status, 200);
  const page = (await call("/modelos/xr150l/")).data.html;
  assert.ok(page.includes("XR150L Edición prueba") && page.includes("Frase de prueba"));
  assert.ok(page.includes("7.123.456"), "muestra el precio nuevo");
  assert.ok(page.includes(up.data.url), "usa la foto subida");
  const served = await fetch(BASE + up.data.url);
  assert.equal(served.headers.get("content-type"), "image/png");
  // restaurar
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, photo_url: "" } });
});

test("un precio vencido se reemplaza por 'Consultá el precio vigente'", async () => {
  const m = await model("biz-110");
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, price_valid_to: "2020-01-01" } });
  const page = (await call("/modelos/biz-110/")).data.html;
  assert.ok(!/\$ 4\.006\.500/.test(page), "no muestra el precio vencido");
  assert.ok(page.includes("Consultá el precio vigente"));
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m } });
});

test("los precios del mes se actualizan en bloque", async () => {
  const m = await model("navi");
  const res = await call("/api/admin/prices", { method: "POST", auth: true, body: { items: [{ slug: "navi", prices: [3999000], price_valid_to: "2099-01-31" }] } });
  assert.equal(res.status, 200);
  assert.equal(res.data.updated, 1);
  assert.ok((await call("/modelos/navi/")).data.html.includes("3.999.000"));
  assert.equal((await call("/api/admin/prices", { method: "POST", auth: true, body: { items: [{ slug: "navi", prices: [-5], price_valid_to: "" }] } })).status, 400);
  assert.equal((await call("/api/admin/prices", { method: "POST", auth: true, body: { items: [{ slug: "navi", prices: [1], price_valid_to: "31/01/2099" }] } })).status, 400);
  await call("/api/admin/prices", { method: "POST", auth: true, body: { items: [{ slug: "navi", prices: [m.versions[0].price], price_valid_to: m.price_valid_to }] } });
});

test("ocultar una moto la saca del catálogo", async () => {
  const m = await model("trx250");
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, active: 0 } });
  assert.equal((await call("/modelos/trx250/")).status, 404);
  assert.ok(!(await call("/")).data.html.includes("TRX250"));
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, active: 1 } });
  assert.equal((await call("/modelos/trx250/")).status, 200);
});

test("volver a importar no pisa lo editado en el panel", async () => {
  const m = await model("nx190");
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, tagline: "Mi frase propia" } });
  await call("/api/admin/import", { method: "POST", auth: true, body: {} });
  assert.equal((await model("nx190")).tagline, "Mi frase propia");
});

test("los textos del sitio se editan y se validan", async () => {
  const got = await call("/api/admin/settings", { auth: true });
  const original = got.data.settings.heroTitle;
  assert.equal((await call("/api/admin/settings", { method: "PUT", auth: true, body: { whatsapp: "no-valido" } })).status, 400);
  assert.equal((await call("/api/admin/settings", { method: "PUT", auth: true, body: { instagram: "http://inseguro" } })).status, 400);
  assert.equal((await call("/api/admin/settings", { method: "PUT", auth: true, body: { heroTitle: "Título de prueba" } })).status, 200);
  assert.ok((await call("/")).data.html.includes("Título de prueba"));
  await call("/api/admin/settings", { method: "PUT", auth: true, body: { heroTitle: original } });
});

test("las entradas inválidas se rechazan", async () => {
  const m = await model("xr150l");
  assert.equal((await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, photo_url: "http://inseguro.example/x.jpg" } })).status, 400);
  assert.equal((await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, versions: [{ name: "x", price: -1 }] } })).status, 400);
  assert.equal((await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, name: "" } })).status, 400);
  assert.equal((await call("/api/admin/models/no-existe", { method: "PUT", auth: true, body: m })).status, 404);
  const html = Buffer.from("<script>alert(1)</script>").toString("base64");
  assert.equal((await call("/api/admin/media", { method: "POST", auth: true, body: { name: "x.png", data: html } })).status, 400);
  // El nombre de una moto con HTML se muestra como texto, no como código.
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m, name: '<img src=x onerror=alert(1)>' } });
  const page = (await call("/modelos/xr150l/")).data.html;
  assert.ok(!page.includes("<img src=x onerror"), "escapado");
  await call(`/api/admin/models/${m.slug}`, { method: "PUT", auth: true, body: { ...m } });
});
